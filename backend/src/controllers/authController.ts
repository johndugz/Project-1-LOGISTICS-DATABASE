import crypto from 'crypto';
import { Request, Response } from 'express';
import { getPool } from '../config/database';
import { hashPassword, generateToken, verifyPassword } from '../utils/auth';
import { logAudit } from '../utils/audit';
import { sendVerificationEmail } from '../utils/email';
import { User, UserRole, JwtPayload } from '../models/types';
import { emitPendingApprovalsUpdate, emitAdminActivityNotification } from '../socket';

const EMAIL_VERIFICATION_MINUTES = 15;

const hashVerificationCode = (value: string): string =>
  crypto.createHash('sha256').update(value).digest('hex');

const generateVerificationCode = (): string =>
  String(Math.floor(100000 + Math.random() * 900000));

export async function register(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user || req.user.role !== UserRole.ADMIN) {
      res.status(403).json({ error: 'Only admins can register users' });
      return;
    }

    const { email, password, firstName, lastName, role, region } = req.body;

    if (!email || !password || !firstName || !lastName) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    const pool = getPool();
    const normalizedEmail = String(email).trim().toLowerCase();

    const { rows: existing } = await pool.query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);

    if (existing.length > 0) {
      res.status(400).json({ error: 'User already exists' });
      return;
    }

    const passwordHash = await hashPassword(password);
    const { rows } = await pool.query(
      `INSERT INTO users (
         email,
         password_hash,
         first_name,
         last_name,
         role,
         region,
         email_verified,
         admin_approved,
         is_active
       )
       VALUES ($1, $2, $3, $4, $5, $6, true, true, true)
       RETURNING id, email, first_name, last_name, role, region`,
      [normalizedEmail, passwordHash, firstName, lastName, role || UserRole.OPERATOR, region || null]
    );

    const user = rows[0];

    await logAudit(
      req.user.userId,
      'CREATE_USER',
      'user',
      user.id,
      { email: normalizedEmail, role: role || UserRole.OPERATOR },
      req.ip
    );

    res.status(201).json({
      message: 'User registered successfully',
      user,
    });
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).json({ error: 'Failed to register user' });
  }
}

export async function signup(req: Request, res: Response): Promise<void> {
  try {
    const { email, password, firstName, lastName } = req.body;

    if (!email || !password || !firstName || !lastName) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    if (typeof password !== 'string' || password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters long' });
      return;
    }

    const pool = getPool();
    const normalizedEmail = String(email).trim().toLowerCase();
    const normalizedFirstName = String(firstName).trim();
    const normalizedLastName = String(lastName).trim();

    const { rows: existing } = await pool.query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);

    if (existing.length > 0) {
      res.status(400).json({ error: 'User already exists' });
      return;
    }

    const verificationCode = generateVerificationCode();
    const verificationCodeHash = hashVerificationCode(verificationCode);
    const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_MINUTES * 60 * 1000);
    const passwordHash = await hashPassword(password);

    const { rows } = await pool.query(
      `INSERT INTO users (
         email,
         password_hash,
         first_name,
         last_name,
         role,
         region,
         email_verified,
         email_verification_code_hash,
         email_verification_expires_at,
         admin_approved,
         is_active
       )
       VALUES ($1, $2, $3, $4, $5, NULL, false, $6, $7, false, true)
       RETURNING id, email, first_name, last_name, role, region`,
      [
        normalizedEmail,
        passwordHash,
        normalizedFirstName,
        normalizedLastName,
        UserRole.CUSTOMER,
        verificationCodeHash,
        expiresAt,
      ]
    );

    const user = rows[0];
    let emailSent = false;

    try {
      emailSent = await sendVerificationEmail(normalizedEmail, verificationCode);
    } catch (emailError) {
      console.warn('Unable to send verification email:', emailError);
    }

    if (!emailSent) {
      console.log(`[DEV EMAIL VERIFICATION] ${normalizedEmail} -> ${verificationCode}`);
    }

    res.status(201).json({
      message: 'Account created. Verify your email, then wait for admin approval.',
      requiresVerification: true,
      requiresAdminApproval: true,
      emailSent,
      ...(emailSent ? {} : { devVerificationCode: verificationCode }),
      user,
    });

    emitPendingApprovalsUpdate();
    emitAdminActivityNotification({
      type: 'new_user',
      message: 'New user has created an account.',
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error creating account:', error);
    res.status(500).json({ error: 'Failed to create account' });
  }
}

export async function verifyEmail(req: Request, res: Response): Promise<void> {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      res.status(400).json({ error: 'Email and verification code are required' });
      return;
    }

    const pool = getPool();
    const normalizedEmail = String(email).trim().toLowerCase();
    const codeHash = hashVerificationCode(String(code).trim());

    const { rows } = await pool.query(
      `SELECT id, email_verified
       FROM users
       WHERE email = $1`,
      [normalizedEmail]
    );

    if (rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    if ((rows[0] as { email_verified: boolean }).email_verified) {
      res.json({ message: 'Email already verified' });
      return;
    }

    const { rowCount } = await pool.query(
      `UPDATE users
       SET email_verified = true,
           email_verification_code_hash = NULL,
           email_verification_expires_at = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE email = $1
         AND email_verification_code_hash = $2
         AND email_verification_expires_at IS NOT NULL
         AND email_verification_expires_at > CURRENT_TIMESTAMP`,
      [normalizedEmail, codeHash]
    );

    if (rowCount === 0) {
      res.status(400).json({ error: 'Invalid or expired verification code' });
      return;
    }

    res.json({ message: 'Email verified successfully. Await admin approval.' });
    emitPendingApprovalsUpdate();
  } catch (error) {
    console.error('Error verifying email:', error);
    res.status(500).json({ error: 'Failed to verify email' });
  }
}

export async function listPendingUsers(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user || req.user.role !== UserRole.ADMIN) {
      res.status(403).json({ error: 'Only admins can view pending users' });
      return;
    }

    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT id, email, first_name, last_name, role, email_verified, admin_approved, created_at
       FROM users
       WHERE role = 'customer' AND (email_verified = false OR admin_approved = false)
       ORDER BY created_at DESC`
    );

    res.json({ data: rows });
  } catch (error) {
    console.error('Error listing pending users:', error);
    res.status(500).json({ error: 'Failed to list pending users' });
  }
}

export async function listCurrentUsers(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user || req.user.role !== UserRole.ADMIN) {
      res.status(403).json({ error: 'Only admins can view users' });
      return;
    }

    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT id,
              email,
              first_name,
              last_name,
              role,
              region,
              phone,
              is_active,
              email_verified,
              admin_approved,
              created_at,
              approved_at,
              updated_at
       FROM users
       ORDER BY created_at DESC`
    );

    res.json({ data: rows });
  } catch (error) {
    console.error('Error listing current users:', error);
    res.status(500).json({ error: 'Failed to list users' });
  }
}

export async function approveUser(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user || req.user.role !== UserRole.ADMIN) {
      res.status(403).json({ error: 'Only admins can approve users' });
      return;
    }

    const { userId } = req.params;
    const role = String(req.body?.role || UserRole.CUSTOMER).toLowerCase();
    const allowedRoles: UserRole[] = [UserRole.ADMIN, UserRole.OPERATOR, UserRole.AUDITOR];

    if (!allowedRoles.includes(role as UserRole)) {
      res.status(400).json({ error: 'Invalid role. Allowed roles: admin, operator, guest' });
      return;
    }

    if (!userId) {
      res.status(400).json({ error: 'User id is required' });
      return;
    }

    const pool = getPool();
    const { rows } = await pool.query(
      `UPDATE users
       SET admin_approved = true,
           role = $3,
           approved_at = CURRENT_TIMESTAMP,
           approved_by = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING id, email, first_name, last_name, role, email_verified, admin_approved`,
      [req.user.userId, userId, role]
    );

    if (rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    await logAudit(
      req.user.userId,
      'APPROVE_USER',
      'user',
      userId,
      { approvedUserId: userId, assignedRole: role },
      req.ip
    );

    res.json({
      message: 'User approved successfully',
      user: rows[0],
    });

    emitPendingApprovalsUpdate();
  } catch (error) {
    console.error('Error approving user:', error);
    res.status(500).json({ error: 'Failed to approve user' });
  }
}

export async function updateUserRole(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user || req.user.role !== UserRole.ADMIN) {
      res.status(403).json({ error: 'Only admins can update user roles' });
      return;
    }

    const { userId } = req.params;
    const role = String(req.body?.role || '').toLowerCase();
    const allowedRoles: UserRole[] = [
      UserRole.ADMIN,
      UserRole.OPERATOR,
      UserRole.AUDITOR,
      UserRole.AGENT,
      UserRole.CUSTOMER,
    ];

    if (!userId) {
      res.status(400).json({ error: 'User id is required' });
      return;
    }

    if (!allowedRoles.includes(role as UserRole)) {
      res.status(400).json({ error: 'Invalid role' });
      return;
    }

    if (req.user.userId === userId) {
      res.status(400).json({ error: 'You cannot change your own role' });
      return;
    }

    const pool = getPool();
    const { rows } = await pool.query(
      `UPDATE users
       SET role = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING id, email, first_name, last_name, role, email_verified, admin_approved, is_active`,
      [userId, role]
    );

    if (rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    await logAudit(
      req.user.userId,
      'UPDATE_USER_ROLE',
      'user',
      userId,
      { updatedUserId: userId, assignedRole: role },
      req.ip
    );

    res.json({
      message: 'User role updated successfully',
      user: rows[0],
    });
  } catch (error) {
    console.error('Error updating user role:', error);
    res.status(500).json({ error: 'Failed to update user role' });
  }
}

export async function updateUser(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user || req.user.role !== UserRole.ADMIN) {
      res.status(403).json({ error: 'Only admins can update users' });
      return;
    }

    const { userId } = req.params;
    const {
      firstName,
      lastName,
      role,
      password,
    } = req.body as {
      firstName?: string;
      lastName?: string;
      role?: string;
      password?: string;
    };

    if (!userId) {
      res.status(400).json({ error: 'User id is required' });
      return;
    }

    const allowedRoles: UserRole[] = [
      UserRole.ADMIN,
      UserRole.OPERATOR,
      UserRole.AUDITOR,
      UserRole.AGENT,
      UserRole.CUSTOMER,
    ];

    const updates: string[] = [];
    const params: Array<string> = [];

    if (typeof firstName === 'string') {
      const trimmedFirstName = firstName.trim();
      if (!trimmedFirstName) {
        res.status(400).json({ error: 'First name cannot be empty' });
        return;
      }
      params.push(trimmedFirstName);
      updates.push(`first_name = $${params.length}`);
    }

    if (typeof lastName === 'string') {
      const trimmedLastName = lastName.trim();
      if (!trimmedLastName) {
        res.status(400).json({ error: 'Last name cannot be empty' });
        return;
      }
      params.push(trimmedLastName);
      updates.push(`last_name = $${params.length}`);
    }

    if (typeof role === 'string') {
      const normalizedRole = role.trim().toLowerCase();
      if (!allowedRoles.includes(normalizedRole as UserRole)) {
        res.status(400).json({ error: 'Invalid role' });
        return;
      }
      if (req.user.userId === userId && normalizedRole !== UserRole.ADMIN) {
        res.status(400).json({ error: 'You cannot remove your own admin role' });
        return;
      }
      params.push(normalizedRole);
      updates.push(`role = $${params.length}`);
    }

    if (typeof password === 'string' && password.trim()) {
      if (password.length < 6) {
        res.status(400).json({ error: 'Password must be at least 6 characters long' });
        return;
      }
      const passwordHash = await hashPassword(password);
      params.push(passwordHash);
      updates.push(`password_hash = $${params.length}`);
    }

    if (updates.length === 0) {
      res.status(400).json({ error: 'No changes provided' });
      return;
    }

    const pool = getPool();
    params.push(userId);

    const { rows } = await pool.query(
      `UPDATE users
       SET ${updates.join(', ')},
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $${params.length}
       RETURNING id, email, first_name, last_name, role, region, phone, is_active, email_verified, admin_approved, created_at, approved_at, updated_at`,
      params
    );

    if (rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    await logAudit(
      req.user.userId,
      'UPDATE_USER',
      'user',
      userId,
      {
        firstName: typeof firstName === 'string' ? firstName.trim() : undefined,
        lastName: typeof lastName === 'string' ? lastName.trim() : undefined,
        role: typeof role === 'string' ? role.trim().toLowerCase() : undefined,
        passwordUpdated: typeof password === 'string' && password.trim().length > 0,
      },
      req.ip
    );

    res.json({
      message: 'User updated successfully',
      user: rows[0],
    });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
}

export async function deleteUser(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user || req.user.role !== UserRole.ADMIN) {
      res.status(403).json({ error: 'Only admins can delete users' });
      return;
    }

    const { userId } = req.params;

    if (!userId) {
      res.status(400).json({ error: 'User id is required' });
      return;
    }

    if (req.user.userId === userId) {
      res.status(400).json({ error: 'You cannot delete your own account' });
      return;
    }

    const pool = getPool();
    const { rows: existingRows } = await pool.query('SELECT id, email FROM users WHERE id = $1', [userId]);

    if (existingRows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    try {
      await pool.query('DELETE FROM users WHERE id = $1', [userId]);
    } catch (dbError) {
      const pgError = dbError as { code?: string };
      if (pgError.code === '23503') {
        res.status(400).json({ error: 'Cannot delete user with related records. Change role or deactivate usage instead.' });
        return;
      }
      throw dbError;
    }

    await logAudit(
      req.user.userId,
      'DELETE_USER',
      'user',
      userId,
      { deletedUserId: userId, deletedUserEmail: existingRows[0].email },
      req.ip
    );

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
}

export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password required' });
      return;
    }

    const pool = getPool();
    const normalizedEmail = String(email).trim().toLowerCase();
    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [normalizedEmail]);

    if (rows.length === 0) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const user: User = rows[0];

    const passwordValid = await verifyPassword(password, user.password_hash);

    if (!passwordValid) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    if (!user.is_active) {
      res.status(403).json({ error: 'User account is disabled' });
      return;
    }

    if (!user.email_verified) {
      res.status(403).json({ error: 'Please verify your email before logging in' });
      return;
    }

    if (!user.admin_approved) {
      res.status(403).json({ error: 'Your account is pending admin approval' });
      return;
    }

    const payload: JwtPayload = {
      userId: user.id,
      email: user.email,
      role: user.role as UserRole,
      region: user.region,
    };

    const token = generateToken(payload);

    await logAudit(
      user.id,
      'LOGIN',
      'user',
      user.id,
      { email: normalizedEmail },
      req.ip
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        region: user.region,
        isActive: user.is_active,
      },
    });
  } catch (error) {
    console.error('Error logging in:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
}

export async function getProfile(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const pool = getPool();
    const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.userId]);

    if (rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const user = rows[0] as User;

    res.json({
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      role: user.role,
      region: user.region,
      phone: user.phone,
      isActive: user.is_active,
    });
  } catch (error) {
    console.error('Error retrieving profile:', error);
    res.status(500).json({ error: 'Failed to retrieve profile' });
  }
}

export async function updateProfile(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { phone, firstName, lastName } = req.body;
    const pool = getPool();

    const { rows } = await pool.query(
      `UPDATE users
       SET phone = COALESCE($1, phone),
           first_name = COALESCE($2, first_name),
           last_name = COALESCE($3, last_name),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4 RETURNING *`,
      [phone || null, firstName || null, lastName || null, req.user.userId]
    );

    res.json({
      message: 'Profile updated successfully',
      user: rows[0],
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
}

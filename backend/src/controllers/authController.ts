import { Request, Response } from 'express';
import { getPool } from '../config/database';
import { hashPassword, generateToken, verifyPassword } from '../utils/auth';
import { logAudit } from '../utils/audit';
import { User, UserRole, JwtPayload } from '../models/types';

export async function register(req: Request, res: Response): Promise<void> {
  try {
    // Only admins can register new users
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

    // Check if user already exists
    const { rows: existing } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

    if (existing.length > 0) {
      res.status(400).json({ error: 'User already exists' });
      return;
    }

    const passwordHash = await hashPassword(password);
    const { rows } = await pool.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, role, region)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, email, first_name, last_name, role, region`,
      [email, passwordHash, firstName, lastName, role || UserRole.OPERATOR, region || null]
    );

    const user = rows[0];

    await logAudit(
      req.user.userId,
      'CREATE_USER',
      'user',
      user.id,
      { email, role: role || UserRole.OPERATOR },
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

export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password required' });
      return;
    }

    const pool = getPool();
    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

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
      { email },
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

    const user = rows[0];

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

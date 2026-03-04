import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { JwtPayload, UserRole } from '../models/types';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRE = process.env.JWT_EXPIRE || '7d';

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateToken(payload: JwtPayload): string {
  return (jwt as any).sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRE });
}

export function verifyToken(token: string): JwtPayload {
  return (jwt as any).verify(token, JWT_SECRET) as JwtPayload;
}

export function generateWaybillNumber(): string {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const sequence = Math.floor(Math.random() * 1000000)
    .toString()
    .padStart(6, '0');
  return `TOPLIS-${dateStr}-${sequence}`;
}

export function generateBookingRef(): string {
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `BK-${timestamp}-${random}`;
}

export function generateQRCode(shipmentId: string, pieceNumber: number): string {
  return `${shipmentId}:${pieceNumber}:${uuidv4().slice(0, 8)}`;
}

export function generateBarcode(): string {
  return Math.random().toString(36).substring(2, 13).toUpperCase();
}

export function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

export function generateApiKey(): string {
  return uuidv4().replace(/-/g, '').substring(0, 32);
}

export function canAccessShipment(
  _userId: string,
  userRole: UserRole,
  userRegion: string | undefined,
  shipmentAssignedAgentRegion: string | undefined
): boolean {
  if (userRole === UserRole.ADMIN) return true;
  if (userRole === UserRole.AUDITOR) return true;
  if (userRole === UserRole.CUSTOMER) return true; // Customers have own endpoint

  if (userRole === UserRole.AGENT && userRegion === shipmentAssignedAgentRegion) {
    return true;
  }

  if (userRole === UserRole.OPERATOR) return true;

  return false;
}

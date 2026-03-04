import { getPool } from '../config/database';
import { AuditLog } from '../models/types';

export async function logAudit(
  userId: string,
  action: string,
  resourceType: string,
  resourceId: string,
  changes?: Record<string, unknown>,
  ipAddress?: string
): Promise<void> {
  try {
    const pool = getPool();
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, changes, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, action, resourceType, resourceId, JSON.stringify(changes || {}), ipAddress]
    );
  } catch (error) {
    console.error('Error logging audit:', error);
  }
}

export async function getAuditLogs(limit: number = 100): Promise<AuditLog[]> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT $1`,
    [limit]
  );
  return rows;
}

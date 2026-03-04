import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/auth';
import { JwtPayload, UserRole } from '../models/types';

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }

    const decoded = verifyToken(token);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function roleMiddleware(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'No user in request' });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        error: `Access denied. Required roles: ${allowedRoles.join(', ')}`,
      });
      return;
    }

    next();
  };
}

export function apiKeyMiddleware(req: Request, res: Response, next: NextFunction): void {
  try {
    const apiKey = req.headers['x-api-key'];

    if (!apiKey) {
      res.status(401).json({ error: 'No API key provided' });
      return;
    }

    // TODO: Validate API key from database
    // For now, this is a placeholder
    req.user = {
      userId: 'api-client',
      email: 'api@toplis.com',
      role: UserRole.OPERATOR,
    };

    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid API key' });
  }
}

export function auditMiddleware(req: Request, res: Response, next: NextFunction): void {
  const originalSend = res.json;
  const startTime = Date.now();

  res.json = function (data: unknown) {
    const duration = Date.now() - startTime;

    // Log audit information
    if (req.user) {
      console.log(`[AUDIT] ${req.user.email} - ${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`);
    }

    return originalSend.call(this, data);
  };

  next();
}

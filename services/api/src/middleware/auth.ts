import { Request, Response, NextFunction } from 'express';
import { verifyToken, getUserById } from '../lib/auth';
import type { User, UserRole } from '@radiolive/shared';

export interface AuthRequest extends Request {
  user?: User;
}

export function authenticate(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : req.cookies?.token;

  if (!token) {
    res.status(401).json({ success: false, error: 'Authentication required' });
    return;
  }

  try {
    const payload = verifyToken(token);
    getUserById(payload.userId).then((user) => {
      if (!user) {
        res.status(401).json({ success: false, error: 'User not found' });
        return;
      }
      req.user = user;
      next();
    }).catch(() => {
      res.status(401).json({ success: false, error: 'Invalid token' });
    });
  } catch {
    res.status(401).json({ success: false, error: 'Invalid token' });
  }
}

export function optionalAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : req.cookies?.token;

  if (!token) {
    next();
    return;
  }

  try {
    const payload = verifyToken(token);
    getUserById(payload.userId).then((user) => {
      if (user) req.user = user;
      next();
    }).catch(() => next());
  } catch {
    next();
  }
}

export function requireRole(...roles: UserRole[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({ success: false, error: 'Insufficient permissions' });
      return;
    }

    next();
  };
}

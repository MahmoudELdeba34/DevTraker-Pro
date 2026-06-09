import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';

export function requireRoles(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    const role = req.userRole;
    if (!role || !roles.includes(role)) {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }
    next();
  };
}

export const PAYROLL_ROLES = ['admin', 'hr', 'accountant'] as const;

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'domain-keeper-secret-key-change-in-production';

export interface AuthRequest extends Request {
  user?: {
    id: number;
    username: string;
    role: string;
    company_id: number | null;
    permissions: string; // JSON array string like '["domain:view","domain:add"]'
  };
}

export function generateToken(user: { id: number; username: string; role: string; company_id: number | null; permissions: string }): string {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role, company_id: user.company_id, permissions: user.permissions },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: '未提供认证令牌' });
    return;
  }

  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: number; username: string; role: string; company_id: number | null; permissions: string };
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: '令牌无效或已过期' });
  }
}

/**
 * @deprecated Use requireRole or requirePermission instead.
 * Kept for backward compatibility but will check for super_admin too.
 */
export function adminMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
  if (req.user?.role !== 'super_admin' && req.user?.role !== 'company_admin') {
    res.status(403).json({ error: '需要管理员权限' });
    return;
  }
  next();
}

export { JWT_SECRET };

import { Request, Response, NextFunction } from 'express';
declare const JWT_SECRET: string;
export interface AuthRequest extends Request {
    user?: {
        id: number;
        username: string;
        role: string;
        company_id: number | null;
        permissions: string;
    };
}
export declare function generateToken(user: {
    id: number;
    username: string;
    role: string;
    company_id: number | null;
    permissions: string;
}): string;
export declare function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): void;
/**
 * @deprecated Use requireRole or requirePermission instead.
 * Kept for backward compatibility but will check for super_admin too.
 */
export declare function adminMiddleware(req: AuthRequest, res: Response, next: NextFunction): void;
export { JWT_SECRET };
//# sourceMappingURL=auth.d.ts.map
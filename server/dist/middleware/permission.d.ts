import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
/**
 * Check permission middleware.
 * super_admin → always pass
 * company_admin → always pass (company scoping done separately in route)
 * user → check permissions JSON array has the required perm
 */
export declare function requirePermission(perm: string): (req: AuthRequest, res: Response, next: NextFunction) => void;
/**
 * Check role middleware.
 */
export declare function requireRole(role: string): (req: AuthRequest, res: Response, next: NextFunction) => void;
/**
 * Helper: return company_id filter for super_admin (no filter) vs others.
 * Returns { companyId, needsJoin } where needsJoin means the query must JOIN users.
 */
export declare function getCompanyFilter(req: AuthRequest): {
    companyId: number | null;
    needsJoin: boolean;
};
//# sourceMappingURL=permission.d.ts.map
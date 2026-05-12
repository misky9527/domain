"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requirePermission = requirePermission;
exports.requireRole = requireRole;
exports.getCompanyFilter = getCompanyFilter;
/**
 * Check permission middleware.
 * super_admin → always pass
 * company_admin → always pass (company scoping done separately in route)
 * user → check permissions JSON array has the required perm
 */
function requirePermission(perm) {
    return (req, res, next) => {
        if (!req.user) {
            res.status(401).json({ error: '未认证' });
            return;
        }
        // super_admin and company_admin bypass permission checks
        if (req.user.role === 'super_admin' || req.user.role === 'company_admin') {
            next();
            return;
        }
        // Check permissions JSON array
        try {
            const perms = req.user.permissions ? JSON.parse(req.user.permissions) : [];
            if (perms.includes(perm)) {
                next();
                return;
            }
        }
        catch (e) {
            // malformed permissions — deny
        }
        res.status(403).json({ error: '没有操作权限' });
    };
}
/**
 * Check role middleware.
 */
function requireRole(role) {
    return (req, res, next) => {
        if (!req.user) {
            res.status(401).json({ error: '未认证' });
            return;
        }
        // super_admin always passes role checks
        if (req.user.role === 'super_admin') {
            next();
            return;
        }
        if (req.user.role !== role) {
            res.status(403).json({ error: `需要 ${role} 角色` });
            return;
        }
        next();
    };
}
/**
 * Helper: return company_id filter for super_admin (no filter) vs others.
 * Returns { companyId, needsJoin } where needsJoin means the query must JOIN users.
 */
function getCompanyFilter(req) {
    if (!req.user)
        return { companyId: null, needsJoin: false };
    if (req.user.role === 'super_admin') {
        return { companyId: null, needsJoin: false };
    }
    if (req.user.role === 'company_admin' || req.user.role === 'user') {
        return { companyId: req.user.company_id, needsJoin: true };
    }
    return { companyId: req.user.company_id, needsJoin: true };
}
//# sourceMappingURL=permission.js.map
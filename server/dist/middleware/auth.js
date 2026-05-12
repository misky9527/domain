"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JWT_SECRET = void 0;
exports.generateToken = generateToken;
exports.authMiddleware = authMiddleware;
exports.adminMiddleware = adminMiddleware;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const JWT_SECRET = process.env.JWT_SECRET || 'domain-keeper-secret-key-change-in-production';
exports.JWT_SECRET = JWT_SECRET;
function generateToken(user) {
    return jsonwebtoken_1.default.sign({ id: user.id, username: user.username, role: user.role, company_id: user.company_id, permissions: user.permissions }, JWT_SECRET, { expiresIn: '7d' });
}
function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: '未提供认证令牌' });
        return;
    }
    const token = authHeader.substring(7);
    try {
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    }
    catch (err) {
        res.status(401).json({ error: '令牌无效或已过期' });
    }
}
/**
 * @deprecated Use requireRole or requirePermission instead.
 * Kept for backward compatibility but will check for super_admin too.
 */
function adminMiddleware(req, res, next) {
    if (req.user?.role !== 'super_admin' && req.user?.role !== 'company_admin') {
        res.status(403).json({ error: '需要管理员权限' });
        return;
    }
    next();
}
//# sourceMappingURL=auth.js.map
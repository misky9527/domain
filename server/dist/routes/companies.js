"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const db_1 = require("../db");
const auth_1 = require("../middleware/auth");
const permission_1 = require("../middleware/permission");
const router = (0, express_1.Router)();
router.use(auth_1.authMiddleware);
// GET /api/companies — list companies
router.get('/', (req, res) => {
    const db = (0, db_1.getDb)();
    if (req.user.role === 'super_admin') {
        const companies = db.prepare(`
      SELECT c.*, COUNT(d.id) as domain_count
      FROM companies c
      LEFT JOIN users u ON u.company_id = c.id
      LEFT JOIN domains d ON d.user_id = u.id
      GROUP BY c.id
      ORDER BY c.name
    `).all();
        res.json({ companies });
        return;
    }
    // company_admin / user: only see their own company
    if (req.user.company_id) {
        const company = db.prepare(`
      SELECT c.*, COUNT(d.id) as domain_count
      FROM companies c
      LEFT JOIN users u ON u.company_id = c.id
      LEFT JOIN domains d ON d.user_id = u.id
      WHERE c.id = ?
      GROUP BY c.id
    `).get(req.user.company_id);
        res.json({ companies: company ? [company] : [] });
        return;
    }
    res.json({ companies: [] });
});
// POST /api/companies — create company (super_admin only)
router.post('/', (0, permission_1.requireRole)('super_admin'), (req, res) => {
    const { name } = req.body;
    if (!name) {
        res.status(400).json({ error: '公司名称不能为空' });
        return;
    }
    const db = (0, db_1.getDb)();
    const result = db.prepare('INSERT INTO companies (name) VALUES (?)').run(name);
    const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ company });
});
// PUT /api/companies/:id — edit company (super_admin only)
router.put('/:id', (0, permission_1.requireRole)('super_admin'), (req, res) => {
    const { name } = req.body;
    const db = (0, db_1.getDb)();
    const result = db.prepare('UPDATE companies SET name = ? WHERE id = ?').run(name, req.params.id);
    if (result.changes === 0) {
        res.status(404).json({ error: '公司不存在' });
        return;
    }
    const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(req.params.id);
    res.json({ company });
});
// DELETE /api/companies/:id — delete company (super_admin only)
router.delete('/:id', (0, permission_1.requireRole)('super_admin'), (req, res) => {
    const db = (0, db_1.getDb)();
    const result = db.prepare('DELETE FROM companies WHERE id = ?').run(req.params.id);
    if (result.changes === 0) {
        res.status(404).json({ error: '公司不存在' });
        return;
    }
    res.json({ message: '删除成功' });
});
// GET /api/companies/:id/users — list users in a company
router.get('/:id/users', (req, res) => {
    const db = (0, db_1.getDb)();
    const companyId = Number(req.params.id);
    // super_admin can see any company's users
    // company_admin can only see their own company's users
    if (req.user.role !== 'super_admin') {
        if (req.user.company_id !== companyId) {
            res.status(403).json({ error: '无权查看该公司用户' });
            return;
        }
    }
    const company = db.prepare('SELECT id, name FROM companies WHERE id = ?').get(companyId);
    if (!company) {
        res.status(404).json({ error: '公司不存在' });
        return;
    }
    const users = db.prepare('SELECT id, username, role, permissions, created_at FROM users WHERE company_id = ? ORDER BY username').all(companyId);
    res.json({ company, users });
});
// POST /api/companies/:id/users — create user in a company
router.post('/:id/users', (req, res) => {
    const db = (0, db_1.getDb)();
    const companyId = Number(req.params.id);
    // super_admin can create in any company
    // company_admin can only create in their own company
    if (req.user.role !== 'super_admin') {
        if (req.user.company_id !== companyId) {
            res.status(403).json({ error: '无权在该公司创建用户' });
            return;
        }
    }
    const { username, password, role = 'user', permissions } = req.body;
    if (!username || !password) {
        res.status(400).json({ error: '用户名和密码不能为空' });
        return;
    }
    // Only super_admin can create company_admin
    if (role === 'company_admin' && req.user.role !== 'super_admin') {
        res.status(403).json({ error: '无权创建管理员用户' });
        return;
    }
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) {
        res.status(409).json({ error: '用户名已存在' });
        return;
    }
    const password_hash = bcryptjs_1.default.hashSync(password, 10);
    const permsJson = permissions ? JSON.stringify(permissions) : '[]';
    const result = db.prepare('INSERT INTO users (username, password_hash, role, company_id, permissions) VALUES (?, ?, ?, ?, ?)').run(username, password_hash, role, companyId, permsJson);
    const user = db.prepare('SELECT id, username, role, permissions FROM users WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ user });
});
// PUT /api/users/:id/permissions — modify user permissions
router.put('/users/:id/permissions', (req, res) => {
    const db = (0, db_1.getDb)();
    const targetId = Number(req.params.id);
    // Can't modify yourself
    if (targetId === req.user.id) {
        res.status(400).json({ error: '不能修改自己的权限' });
        return;
    }
    const targetUser = db.prepare('SELECT id, company_id, role FROM users WHERE id = ?').get(targetId);
    if (!targetUser) {
        res.status(404).json({ error: '用户不存在' });
        return;
    }
    // super_admin can modify anyone
    // company_admin can only modify users in their own company, and only regular users
    if (req.user.role !== 'super_admin') {
        if (req.user.company_id !== targetUser.company_id) {
            res.status(403).json({ error: '无权修改其他公司的用户' });
            return;
        }
        if (targetUser.role !== 'user') {
            res.status(403).json({ error: '只能修改普通用户的权限' });
            return;
        }
    }
    const { permissions } = req.body;
    const permsJson = permissions ? JSON.stringify(permissions) : '[]';
    db.prepare('UPDATE users SET permissions = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(permsJson, targetId);
    const updated = db.prepare('SELECT id, username, role, permissions FROM users WHERE id = ?').get(targetId);
    res.json({ user: updated });
});
// DELETE /api/users/:id — delete user
router.delete('/users/:id', (req, res) => {
    const db = (0, db_1.getDb)();
    const targetId = Number(req.params.id);
    // Can't delete yourself
    if (targetId === req.user.id) {
        res.status(400).json({ error: '不能删除自己的账号' });
        return;
    }
    const targetUser = db.prepare('SELECT id, company_id, role FROM users WHERE id = ?').get(targetId);
    if (!targetUser) {
        res.status(404).json({ error: '用户不存在' });
        return;
    }
    // super_admin can delete anyone
    // company_admin can only delete regular users in their own company
    if (req.user.role !== 'super_admin') {
        if (req.user.company_id !== targetUser.company_id) {
            res.status(403).json({ error: '无权删除其他公司的用户' });
            return;
        }
        if (targetUser.role !== 'user') {
            res.status(403).json({ error: '只能删除普通用户' });
            return;
        }
    }
    db.prepare('DELETE FROM users WHERE id = ?').run(targetId);
    res.json({ message: '删除成功' });
});
exports.default = router;
//# sourceMappingURL=companies.js.map
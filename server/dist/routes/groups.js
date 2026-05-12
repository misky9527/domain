"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../db");
const auth_1 = require("../middleware/auth");
const permission_1 = require("../middleware/permission");
const router = (0, express_1.Router)();
router.use(auth_1.authMiddleware);
// List groups
router.get('/', (req, res) => {
    const db = (0, db_1.getDb)();
    const filter = (0, permission_1.getCompanyFilter)(req);
    const userId = req.user.id;
    let groups;
    if (filter.companyId === null && !filter.needsJoin) {
        // super_admin — see all groups, include username
        groups = db.prepare(`
      SELECT g.*, u.username,
        (SELECT COUNT(*) FROM domains d WHERE d.group_id = g.id) as domain_count
      FROM domain_groups g
      LEFT JOIN users u ON g.user_id = u.id
      ORDER BY g.name
    `).all();
    }
    else if (filter.companyId !== null && filter.needsJoin) {
        // company_admin — see groups of all users in the company
        groups = db.prepare(`
      SELECT g.*, u.username,
        (SELECT COUNT(*) FROM domains d WHERE d.group_id = g.id) as domain_count
      FROM domain_groups g
      LEFT JOIN users u ON g.user_id = u.id
      WHERE u.company_id = ?
      ORDER BY g.name
    `).all(filter.companyId);
    }
    else {
        groups = db.prepare('SELECT g.*, (SELECT COUNT(*) FROM domains d WHERE d.group_id = g.id) as domain_count FROM domain_groups g WHERE g.user_id = ? ORDER BY g.name').all(userId);
    }
    res.json({ groups });
});
// Create group
router.post('/', (req, res) => {
    const { name } = req.body;
    if (!name) {
        res.status(400).json({ error: '分组名称不能为空' });
        return;
    }
    const db = (0, db_1.getDb)();
    const result = db.prepare('INSERT INTO domain_groups (user_id, name) VALUES (?, ?)').run(req.user.id, name);
    const group = db.prepare('SELECT * FROM domain_groups WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ group });
});
// Update group
router.put('/:id', (req, res) => {
    const { name } = req.body;
    const db = (0, db_1.getDb)();
    const result = db.prepare('UPDATE domain_groups SET name = ? WHERE id = ? AND user_id = ?').run(name, req.params.id, req.user.id);
    if (result.changes === 0) {
        res.status(404).json({ error: '分组不存在' });
        return;
    }
    res.json({ message: '更新成功' });
});
// Delete group
router.delete('/:id', (req, res) => {
    const db = (0, db_1.getDb)();
    // Set domains in this group to null
    db.prepare('UPDATE domains SET group_id = NULL WHERE group_id = ? AND user_id = ?').run(req.params.id, req.user.id);
    const result = db.prepare('DELETE FROM domain_groups WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
    if (result.changes === 0) {
        res.status(404).json({ error: '分组不存在' });
        return;
    }
    res.json({ message: '删除成功' });
});
exports.default = router;
//# sourceMappingURL=groups.js.map
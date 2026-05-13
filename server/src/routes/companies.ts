import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { getDb } from '../db';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { requireRole, requirePermission, getCompanyFilter } from '../middleware/permission';

const router = Router();
router.use(authMiddleware);

// GET /api/companies — list companies
router.get('/', (req: AuthRequest, res: Response) => {
  const db = getDb();

  if (req.user!.role === 'super_admin') {
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
  if (req.user!.company_id) {
    const company = db.prepare(`
      SELECT c.*, COUNT(d.id) as domain_count
      FROM companies c
      LEFT JOIN users u ON u.company_id = c.id
      LEFT JOIN domains d ON d.user_id = u.id
      WHERE c.id = ?
      GROUP BY c.id
    `).get(req.user!.company_id);
    res.json({ companies: company ? [company] : [] });
    return;
  }

  res.json({ companies: [] });
});

// POST /api/companies — create company (super_admin only)
router.post('/', requireRole('super_admin'), (req: AuthRequest, res: Response) => {
  const { name } = req.body;
  if (!name) {
    res.status(400).json({ error: '公司名称不能为空' });
    return;
  }

  const db = getDb();
  const result = db.prepare('INSERT INTO companies (name) VALUES (?)').run(name);
  const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ company });
});

// PUT /api/companies/:id — edit company (super_admin only)
router.put('/:id', requireRole('super_admin'), (req: AuthRequest, res: Response) => {
  const { name } = req.body;
  const db = getDb();
  const result = db.prepare('UPDATE companies SET name = ? WHERE id = ?').run(name, req.params.id);
  if (result.changes === 0) {
    res.status(404).json({ error: '公司不存在' });
    return;
  }
  const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(req.params.id);
  res.json({ company });
});

// DELETE /api/companies/:id — delete company (super_admin only, must be empty first)
router.delete('/:id', requireRole('super_admin'), (req: AuthRequest, res: Response) => {
  const db = getDb();
  const companyId = Number(req.params.id);

  const company = db.prepare('SELECT id, name FROM companies WHERE id = ?').get(companyId) as any;
  if (!company) {
    res.status(404).json({ error: '公司不存在' });
    return;
  }

  // Check that company has no users
  const userCount = (db.prepare('SELECT COUNT(*) as cnt FROM users WHERE company_id = ?').get(companyId) as any).cnt;
  if (userCount > 0) {
    res.status(409).json({ error: '该公司下还有 ' + userCount + ' 个用户，请先删除所有用户后再删除公司' });
    return;
  }

  // Check that company has no domains (via user links — though users are 0, double-check domains directly)
  const domainCount = (db.prepare(
    'SELECT COUNT(*) as cnt FROM domains d INNER JOIN users u ON d.user_id = u.id WHERE u.company_id = ?'
  ).get(companyId) as any).cnt;
  if (domainCount > 0) {
    res.status(409).json({ error: '该公司下还有 ' + domainCount + ' 个域名，请先删除所有域名后再删除公司' });
    return;
  }

  db.prepare('DELETE FROM companies WHERE id = ?').run(companyId);
  res.json({ message: '公司「' + company.name + '」删除成功' });
});

// GET /api/companies/:id/users — list users in a company
router.get('/:id/users', (req: AuthRequest, res: Response) => {
  const db = getDb();
  const companyId = Number(req.params.id);

  // super_admin can see any company's users
  // company_admin can only see their own company's users
  if (req.user!.role !== 'super_admin') {
    if (req.user!.company_id !== companyId) {
      res.status(403).json({ error: '无权查看该公司用户' });
      return;
    }
  }

  const company = db.prepare('SELECT id, name FROM companies WHERE id = ?').get(companyId) as any;
  if (!company) {
    res.status(404).json({ error: '公司不存在' });
    return;
  }

  const users = db.prepare(
    'SELECT id, username, role, permissions, created_at FROM users WHERE company_id = ? ORDER BY username'
  ).all(companyId);
  res.json({ company, users });
});

// POST /api/companies/:id/users — create user in a company
router.post('/:id/users', (req: AuthRequest, res: Response) => {
  const db = getDb();
  const companyId = Number(req.params.id);

  // super_admin can create in any company
  // company_admin can only create in their own company
  if (req.user!.role !== 'super_admin') {
    if (req.user!.company_id !== companyId) {
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
  if (role === 'company_admin' && req.user!.role !== 'super_admin') {
    res.status(403).json({ error: '无权创建管理员用户' });
    return;
  }

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    res.status(409).json({ error: '用户名已存在' });
    return;
  }

  const password_hash = bcrypt.hashSync(password, 10);
  const permsJson = permissions ? JSON.stringify(permissions) : '[]';
  const result = db.prepare(
    'INSERT INTO users (username, password_hash, role, company_id, permissions) VALUES (?, ?, ?, ?, ?)'
  ).run(username, password_hash, role, companyId, permsJson);

  const user = db.prepare(
    'SELECT id, username, role, permissions FROM users WHERE id = ?'
  ).get(result.lastInsertRowid);
  res.status(201).json({ user });
});

// PUT /api/users/:id/permissions — modify user permissions
router.put('/users/:id/permissions', (req: AuthRequest, res: Response) => {
  const db = getDb();
  const targetId = Number(req.params.id);

  // Can't modify yourself
  if (targetId === req.user!.id) {
    res.status(400).json({ error: '不能修改自己的权限' });
    return;
  }

  const targetUser = db.prepare('SELECT id, company_id, role FROM users WHERE id = ?').get(targetId) as any;
  if (!targetUser) {
    res.status(404).json({ error: '用户不存在' });
    return;
  }

  // super_admin can modify anyone
  // company_admin can only modify users in their own company, and only regular users
  if (req.user!.role !== 'super_admin') {
    if (req.user!.company_id !== targetUser.company_id) {
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

// PUT /api/users/:id — edit user (username/password)
router.put('/users/:id', (req: AuthRequest, res: Response) => {
  const db = getDb();
  const targetId = Number(req.params.id);

  // Can't modify your own username (prevents lockout)
  if (targetId === req.user!.id) {
    res.status(400).json({ error: '不能修改自己的用户名' });
    return;
  }

  const targetUser = db.prepare('SELECT id, company_id, role FROM users WHERE id = ?').get(targetId) as any;
  if (!targetUser) {
    res.status(404).json({ error: '用户不存在' });
    return;
  }

  // super_admin can edit anyone
  // company_admin can only edit regular users in their own company
  if (req.user!.role !== 'super_admin') {
    if (req.user!.company_id !== targetUser.company_id) {
      res.status(403).json({ error: '无权修改其他公司的用户' });
      return;
    }
    if (targetUser.role !== 'user') {
      res.status(403).json({ error: '只能修改普通用户' });
      return;
    }
  }

  const { username, password } = req.body;

  if (username) {
    // Check for duplicate username
    const existing = db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(username, targetId);
    if (existing) {
      res.status(409).json({ error: '用户名已存在' });
      return;
    }
    db.prepare('UPDATE users SET username = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(username, targetId);
  }

  if (password) {
    const password_hash = bcrypt.hashSync(password, 10);
    db.prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(password_hash, targetId);
  }

  const updated = db.prepare('SELECT id, username, role, permissions FROM users WHERE id = ?').get(targetId);
  res.json({ user: updated });
});

// DELETE /api/users/:id — delete user
router.delete('/users/:id', (req: AuthRequest, res: Response) => {
  const db = getDb();
  const targetId = Number(req.params.id);

  // Can't delete yourself
  if (targetId === req.user!.id) {
    res.status(400).json({ error: '不能删除自己的账号' });
    return;
  }

  const targetUser = db.prepare('SELECT id, company_id, role FROM users WHERE id = ?').get(targetId) as any;
  if (!targetUser) {
    res.status(404).json({ error: '用户不存在' });
    return;
  }

  // super_admin can delete anyone
  // company_admin can only delete regular users in their own company
  if (req.user!.role !== 'super_admin') {
    if (req.user!.company_id !== targetUser.company_id) {
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

export default router;

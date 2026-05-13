import { Router, Response } from 'express';
import { getDb, logOperation } from '../db';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { requireRole } from '../middleware/permission';
import { createBackup, listBackups, deleteBackup } from '../services/backup';

const router = Router();
router.use(authMiddleware);

// GET /api/admin/orphans — 查看所有无公司归属的用户
router.get('/orphans', requireRole('super_admin'), (req: AuthRequest, res: Response) => {
  const db = getDb();
  const orphans = db.prepare(`
    SELECT u.id, u.username, u.role, u.created_at,
      u.permissions, u.status,
      (SELECT COUNT(*) FROM domains d WHERE d.user_id = u.id) as domain_count
    FROM users u
    WHERE u.company_id IS NULL AND u.role != 'super_admin'
    ORDER BY u.created_at DESC
  `).all() as any[];

  // For each orphan, get their domains with details
  const result = orphans.map((u: any) => {
    const domains = db.prepare(`
      SELECT id, name, registrar, created_at FROM domains WHERE user_id = ?
    `).all(u.id);
    return { ...u, domains };
  });

  res.json({ orphans: result });
});

// DELETE /api/admin/orphans/:id — 删除孤悬用户
router.delete('/orphans/:id', requireRole('super_admin'), (req: AuthRequest, res: Response) => {
  const db = getDb();
  const userId = Number(req.params.id);

  const user = db.prepare('SELECT id, username FROM users WHERE id = ? AND company_id IS NULL').get(userId) as any;
  if (!user) {
    res.status(404).json({ error: '用户不存在或无公司归属' });
    return;
  }

  // Delete related data
  db.prepare('DELETE FROM reminder_log WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM domains WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM domain_groups WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM users WHERE id = ?').run(userId);

  logOperation(req.user!.id, req.user!.username, 'delete', 'user', userId, user.username, '删除孤悬用户及关联域名');
  res.json({ message: '已删除用户「' + user.username + '」及关联数据' });
});

// POST /api/admin/orphans/:id/assign — 重新分配归属公司
router.post('/orphans/:id/assign', requireRole('super_admin'), (req: AuthRequest, res: Response) => {
  const db = getDb();
  const userId = Number(req.params.id);
  const { company_id } = req.body;

  if (!company_id) {
    res.status(400).json({ error: '请指定目标公司' });
    return;
  }

  const user = db.prepare('SELECT id, username FROM users WHERE id = ? AND company_id IS NULL').get(userId) as any;
  if (!user) {
    res.status(404).json({ error: '用户不存在或无公司归属' });
    return;
  }

  const company = db.prepare('SELECT id, name FROM companies WHERE id = ?').get(company_id) as any;
  if (!company) {
    res.status(404).json({ error: '目标公司不存在' });
    return;
  }

  db.prepare('UPDATE users SET company_id = ? WHERE id = ?').run(company_id, userId);
  logOperation(req.user!.id, req.user!.username, 'update', 'user', userId, user.username, '重新分配归属公司: ' + company.name);

  const updated = db.prepare('SELECT id, username, role, company_id FROM users WHERE id = ?').get(userId);
  res.json({ user: updated, message: '用户「' + user.username + '」已分配到公司「' + company.name + '」' });
});

// GET /api/admin/logs — 操作日志
router.get('/logs', requireRole('super_admin'), (req: AuthRequest, res: Response) => {
  const db = getDb();
  const page = Math.max(1, parseInt(String(req.query.page)) || 1);
  const pageSize = Math.min(100, Math.max(10, parseInt(String(req.query.pageSize)) || 50));
  const offset = (page - 1) * pageSize;
  const action = req.query.action as string;
  const targetType = req.query.target_type as string;

  let where = '';
  const params: any[] = [];
  if (action) { where += (where ? ' AND ' : ' WHERE ') + 'action = ?'; params.push(action); }
  if (targetType) { where += (where ? ' AND ' : ' WHERE ') + 'target_type = ?'; params.push(targetType); }

  const total = (db.prepare('SELECT COUNT(*) as cnt FROM operation_logs' + where).get(...params) as any).cnt;
  const logs = db.prepare(
    'SELECT * FROM operation_logs' + where + ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
  ).all(...params, pageSize, offset);

  res.json({ logs, total, page, pageSize });
});

// POST /api/admin/backup — 手动创建备份
router.post('/backup', requireRole('super_admin'), (req: AuthRequest, res: Response) => {
  try {
    const result = createBackup();
    logOperation(req.user!.id, req.user!.username, 'create', 'backup', undefined, result.filename, '手动创建数据库备份');
    res.json({ message: '备份成功', backup: result });
  } catch (err: any) {
    res.status(500).json({ error: '备份失败: ' + (err.message || '未知错误') });
  }
});

// GET /api/admin/backups — 列出所有备份
router.get('/backups', requireRole('super_admin'), (req: AuthRequest, res: Response) => {
  try {
    const backups = listBackups();
    res.json({ backups });
  } catch (err: any) {
    res.status(500).json({ error: '获取备份列表失败' });
  }
});

// DELETE /api/admin/backups/:filename — 删除备份
router.delete('/backups/:filename', requireRole('super_admin'), (req: AuthRequest, res: Response) => {
  const { filename } = req.params;
  if (!filename.endsWith('.db')) {
    res.status(400).json({ error: '无效的备份文件' });
    return;
  }
  const ok = deleteBackup(filename);
  if (!ok) {
    res.status(404).json({ error: '备份文件不存在' });
    return;
  }
  logOperation(req.user!.id, req.user!.username, 'delete', 'backup', undefined, filename, '删除数据库备份');
  res.json({ message: '已删除备份: ' + filename });
});

export default router;

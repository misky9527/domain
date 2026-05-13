import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { getDb, logOperation } from '../db';
import { AuthRequest, generateToken, authMiddleware } from '../middleware/auth';

const router = Router();

// Register (creates company + pending user)
router.post('/register', (req: AuthRequest, res: Response) => {
  const { company_name, username, password } = req.body;
  if (!company_name || !username || !password) {
    res.status(400).json({ error: '公司名称、用户名和密码不能为空' });
    return;
  }

  const db = getDb();
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    res.status(409).json({ error: '用户名已存在' });
    return;
  }

  const password_hash = bcrypt.hashSync(password, 10);
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };

  // First user ever = super_admin (no approval needed), others = pending
  if (userCount.count === 0) {
    // First user: super_admin, no company needed
    const result = db.prepare(
      'INSERT INTO users (username, password_hash, role, status) VALUES (?, ?, ?, ?)'
    ).run(username, password_hash, 'super_admin', 'approved');

    const token = generateToken({
      id: result.lastInsertRowid as number,
      username,
      role: 'super_admin',
      company_id: null,
      permissions: '',
    });
    res.status(201).json({ token, user: { id: result.lastInsertRowid, username, role: 'super_admin', company_id: null, permissions: '', status: 'approved' } });
    return;
  }

  // Create company
  const companyResult = db.prepare('INSERT INTO companies (name) VALUES (?)').run(company_name);

  // Create pending user as company_admin
  const result = db.prepare(
    'INSERT INTO users (username, password_hash, role, company_id, status) VALUES (?, ?, ?, ?, ?)'
  ).run(username, password_hash, 'company_admin', companyResult.lastInsertRowid, 'pending');

  const userId = result.lastInsertRowid as number;
  const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(companyResult.lastInsertRowid) as any;

  logOperation(userId, username, 'create', 'company', company.id, company_name);
  logOperation(userId, username, 'create', 'user', userId, username);

  res.status(201).json({
    message: '注册成功，请等待管理员审核',
    pending: true,
    company: { id: company.id, name: company.name },
    user: { id: userId, username, role: 'company_admin', company_id: companyResult.lastInsertRowid },
  });
});

// Login (check status)
router.post('/login', (req: AuthRequest, res: Response) => {
  const { username, password } = req.body;
  if (!username || !password) {
    res.status(400).json({ error: '用户名和密码不能为空' });
    return;
  }

  const db = getDb();
  const user = db.prepare('SELECT id, username, password_hash, role, company_id, permissions, status FROM users WHERE username = ?').get(username) as any;
  if (!user) {
    res.status(401).json({ error: '用户名或密码错误' });
    return;
  }

  if (!bcrypt.compareSync(password, user.password_hash)) {
    res.status(401).json({ error: '用户名或密码错误' });
    return;
  }

  if (user.status === 'pending') {
    res.status(403).json({ error: '账号正在审核中，请等待管理员审核通过' });
    return;
  }
  if (user.status === 'rejected') {
    res.status(403).json({ error: '注册申请已被拒绝，请联系管理员' });
    return;
  }

  const token = generateToken({
    id: user.id,
    username: user.username,
    role: user.role,
    company_id: user.company_id,
    permissions: user.permissions || '',
  });

  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      company_id: user.company_id,
      permissions: user.permissions || '',
      status: user.status,
    },
  });
});

// Get current user
router.get('/me', authMiddleware, (req: AuthRequest, res: Response) => {
  const db = getDb();
  const user = db.prepare('SELECT id, username, role, company_id, permissions, status, telegram_bot_token, telegram_chat_id FROM users WHERE id = ?').get(req.user!.id) as any;
  if (!user) {
    res.status(404).json({ error: '用户不存在' });
    return;
  }
  res.json({ user });
});

// [Super Admin] List pending registrations
router.get('/pending-registrations', authMiddleware, (req: AuthRequest, res: Response) => {
  if (req.user!.role !== 'super_admin') {
    res.status(403).json({ error: '仅管理员可查看' });
    return;
  }

  const db = getDb();
  const pending = db.prepare(`
    SELECT u.id, u.username, u.role, u.created_at, u.company_id, c.name as company_name
    FROM users u LEFT JOIN companies c ON u.company_id = c.id
    WHERE u.status = 'pending'
    ORDER BY u.created_at DESC
  `).all();

  res.json({ pending });
});

// [Super Admin] Approve registration
router.post('/approve/:id', authMiddleware, (req: AuthRequest, res: Response) => {
  if (req.user!.role !== 'super_admin') {
    res.status(403).json({ error: '仅管理员可审核' });
    return;
  }

  const db = getDb();
  const user = db.prepare('SELECT id, username, status FROM users WHERE id = ?').get(req.params.id) as any;
  if (!user) {
    res.status(404).json({ error: '用户不存在' });
    return;
  }
  if (user.status !== 'pending') {
    res.status(400).json({ error: '该用户无需审核' });
    return;
  }

  db.prepare("UPDATE users SET status = 'approved' WHERE id = ?").run(req.params.id);
  logOperation(req.user!.id, req.user!.username, 'update', 'user', user.id, user.username, '审核通过');
  res.json({ message: `已通过 ${user.username} 的注册申请` });
});

// [Super Admin] Reject registration
router.post('/reject/:id', authMiddleware, (req: AuthRequest, res: Response) => {
  if (req.user!.role !== 'super_admin') {
    res.status(403).json({ error: '仅管理员可审核' });
    return;
  }

  const db = getDb();
  const user = db.prepare('SELECT id, username, status FROM users WHERE id = ?').get(req.params.id) as any;
  if (!user) {
    res.status(404).json({ error: '用户不存在' });
    return;
  }
  if (user.status !== 'pending') {
    res.status(400).json({ error: '该用户无需审核' });
    return;
  }

  db.prepare("UPDATE users SET status = 'rejected' WHERE id = ?").run(req.params.id);
  logOperation(req.user!.id, req.user!.username, 'delete', 'user', user.id, user.username, '审核拒绝');
  res.json({ message: `已拒绝 ${user.username} 的注册申请` });
});

// Change own password
router.put('/password', authMiddleware, (req: AuthRequest, res: Response) => {
  const { old_password, new_password } = req.body;
  if (!old_password || !new_password) {
    res.status(400).json({ error: '旧密码和新密码不能为空' });
    return;
  }

  if (new_password.length < 6) {
    res.status(400).json({ error: '新密码至少6位' });
    return;
  }

  const db = getDb();
  const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user!.id) as any;
  if (!user) {
    res.status(404).json({ error: '用户不存在' });
    return;
  }

  if (!bcrypt.compareSync(old_password, user.password_hash)) {
    res.status(400).json({ error: '旧密码错误' });
    return;
  }

  const password_hash = bcrypt.hashSync(new_password, 10);
  db.prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(password_hash, req.user!.id);

  res.json({ message: '密码修改成功' });
});

export default router;

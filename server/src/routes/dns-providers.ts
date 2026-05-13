import { Router, Response } from 'express';
import { getDb, logOperation } from '../db';
import { AuthRequest, authMiddleware } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

// List all DNS providers (any authenticated user can view)
router.get('/', (req: AuthRequest, res: Response) => {
  const db = getDb();
  const providers = db.prepare('SELECT * FROM dns_providers ORDER BY domain ASC').all();
  res.json({ providers });
});

// Add a DNS provider (super_admin only)
router.post('/', (req: AuthRequest, res: Response) => {
  if (req.user!.role !== 'super_admin') {
    res.status(403).json({ error: '仅超级管理员可管理 DNS 服务商' });
    return;
  }

  const { domain, name } = req.body;
  if (!domain || !name) {
    res.status(400).json({ error: '请提供 domain 和 name' });
    return;
  }

  const cleanDomain = domain.trim().toLowerCase().replace(/\.$/, '');
  
  const db = getDb();
  
  // Check for duplicate
  const existing = db.prepare('SELECT id FROM dns_providers WHERE domain = ?').get(cleanDomain);
  if (existing) {
    res.status(409).json({ error: '该域名已存在' });
    return;
  }

  const result = db.prepare('INSERT INTO dns_providers (domain, name) VALUES (?, ?)').run(cleanDomain, name.trim());
  const provider = db.prepare('SELECT * FROM dns_providers WHERE id = ?').get(result.lastInsertRowid) as any;
  logOperation(req.user!.id, req.user!.username, 'create', 'dns_provider', provider.id, name.trim());
  res.status(201).json({ provider });
});

// Update a DNS provider (super_admin only)
router.put('/:id', (req: AuthRequest, res: Response) => {
  if (req.user!.role !== 'super_admin') {
    res.status(403).json({ error: '仅超级管理员可管理 DNS 服务商' });
    return;
  }

  const { domain, name } = req.body;
  const db = getDb();

  const existing = db.prepare('SELECT id FROM dns_providers WHERE id = ?').get(req.params.id);
  if (!existing) {
    res.status(404).json({ error: '记录不存在' });
    return;
  }

  if (domain) {
    const cleanDomain = domain.trim().toLowerCase().replace(/\.$/, '');
    // Check uniqueness except self
    const dup = db.prepare('SELECT id FROM dns_providers WHERE domain = ? AND id != ?').get(cleanDomain, req.params.id);
    if (dup) {
      res.status(409).json({ error: '该域名已存在' });
      return;
    }
    db.prepare('UPDATE dns_providers SET domain = ?, name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(cleanDomain, (name || '').trim(), req.params.id);
  } else {
    db.prepare('UPDATE dns_providers SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run((name || '').trim(), req.params.id);
  }

  const provider = db.prepare('SELECT * FROM dns_providers WHERE id = ?').get(req.params.id) as any;
  logOperation(req.user!.id, req.user!.username, 'update', 'dns_provider', provider.id, provider.domain);
  res.json({ provider });
});

// Delete a DNS provider (super_admin only)
router.delete('/:id', (req: AuthRequest, res: Response) => {
  if (req.user!.role !== 'super_admin') {
    res.status(403).json({ error: '仅超级管理员可管理 DNS 服务商' });
    return;
  }

  const db = getDb();
  const provider = db.prepare('SELECT domain FROM dns_providers WHERE id = ?').get(req.params.id) as any;
  const result = db.prepare('DELETE FROM dns_providers WHERE id = ?').run(req.params.id);
  if (result.changes === 0) {
    res.status(404).json({ error: '记录不存在' });
    return;
  }
  logOperation(req.user!.id, req.user!.username, 'delete', 'dns_provider', Number(req.params.id), provider?.domain || '');
  res.json({ message: '删除成功' });
});

export default router;

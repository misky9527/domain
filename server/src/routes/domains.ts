import { Router, Response } from 'express';
import multer from 'multer';
import * as XLSX from 'xlsx';
import { getDb, getOrCreateDefaultGroup, getOrCreateGroup } from '../db';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { requirePermission, getCompanyFilter } from '../middleware/permission';
import { queryWhois, queryBatchWhois } from '../services/whois';
import { queryDnsRecords, queryNsRecords, extractNsInfo } from '../services/dns';
import { checkSsl } from '../services/ssl';
import { manualExpiryCheck } from '../services/reminder';

const router = Router();
router.use(authMiddleware);

// List domains
router.get('/', (req: AuthRequest, res: Response) => {
  const db = getDb();
  const { search, group_id, sort_by, sort_order, page = '1', page_size = '20' } = req.query;
  const filter = getCompanyFilter(req);
  const userId = req.user!.id;

  let sql: string;
  let params: any[];

  if (filter.companyId === null && !filter.needsJoin) {
    // super_admin — see all domains
    sql = 'SELECT d.*, dg.name as group_name, u.username, c.name as company_name FROM domains d LEFT JOIN domain_groups dg ON d.group_id = dg.id LEFT JOIN users u ON d.user_id = u.id LEFT JOIN companies c ON u.company_id = c.id WHERE 1=1';
    params = [];
  } else if (filter.companyId !== null && filter.needsJoin) {
    // company_admin or user — join users to filter by company
    sql = 'SELECT d.*, dg.name as group_name, u.username, c.name as company_name FROM domains d LEFT JOIN domain_groups dg ON d.group_id = dg.id LEFT JOIN users u ON d.user_id = u.id LEFT JOIN companies c ON u.company_id = c.id WHERE u.company_id = ?';
    params = [filter.companyId];
  } else {
    // fallback: just user's own domains
    sql = 'SELECT d.*, dg.name as group_name FROM domains d LEFT JOIN domain_groups dg ON d.group_id = dg.id WHERE d.user_id = ?';
    params = [userId];
  }

  if (search) {
    sql += ' AND d.name LIKE ?';
    params.push(`%${search}%`);
  }
  if (group_id) {
    sql += ' AND d.group_id = ?';
    params.push(Number(group_id));
  }

  // Count total
  const countSql = sql.replace(/SELECT d\..*? FROM/, 'SELECT COUNT(*) as total FROM');
  const total = (db.prepare(countSql).get(...params) as any).total;

  // Sort
  const allowedSort = ['name', 'expiration_date', 'created_at', 'registrar'];
  const sort = allowedSort.includes(sort_by as string) ? sort_by : 'created_at';
  const order = sort_order === 'asc' ? 'ASC' : 'DESC';
  sql += ` ORDER BY d.${sort} ${order}`;

  // Paginate
  const p = Math.max(1, Number(page));
  const ps = Math.min(100, Math.max(1, Number(page_size)));
  sql += ' LIMIT ? OFFSET ?';
  params.push(ps, (p - 1) * ps);

  // Don't need to parse dns_records for NS info anymore;
  // dns_ns_server and dns_ns_provider are stored as DB columns.
  const domains = db.prepare(sql).all(...params).map((d: any) => {
    // Backfill: if NS info is missing but dns_records exists, try to extract
    if (!d.dns_ns_server && d.dns_records && d.dns_records.length > 2) {
      try {
        const records = JSON.parse(d.dns_records);
        const nsInfo = extractNsInfo(records);
        if (nsInfo) {
          d.dns_ns_server = nsInfo.server;
          d.dns_ns_provider = nsInfo.provider || '';
          // Save to DB for future reads
          db.prepare('UPDATE domains SET dns_ns_server = ?, dns_ns_provider = ? WHERE id = ?')
            .run(nsInfo.server, nsInfo.provider || '', d.id);
        }
      } catch { /* ignore parse errors */ }
    }
    return d;
  });
  res.json({ domains, total, page: p, page_size: ps });
});

// Get single domain
router.get('/:id', (req: AuthRequest, res: Response) => {
  const db = getDb();
  const filter = getCompanyFilter(req);
  const userId = req.user!.id;

  let domain: any;

  if (filter.companyId === null && !filter.needsJoin) {
    // super_admin — can access any domain
    domain = db.prepare('SELECT d.*, dg.name as group_name, u.username FROM domains d LEFT JOIN domain_groups dg ON d.group_id = dg.id LEFT JOIN users u ON d.user_id = u.id WHERE d.id = ?').get(req.params.id);
  } else if (filter.companyId !== null && filter.needsJoin) {
    domain = db.prepare(
      'SELECT d.*, dg.name as group_name, u.username FROM domains d LEFT JOIN domain_groups dg ON d.group_id = dg.id LEFT JOIN users u ON d.user_id = u.id WHERE d.id = ? AND u.company_id = ?'
    ).get(req.params.id, filter.companyId);
  } else {
    domain = db.prepare('SELECT d.*, dg.name as group_name FROM domains d LEFT JOIN domain_groups dg ON d.group_id = dg.id WHERE d.id = ? AND d.user_id = ?').get(req.params.id, userId);
  }

  if (!domain) {
    res.status(404).json({ error: '域名不存在' });
    return;
  }
  res.json({ domain });
});

// Query whois (not save)
router.post('/whois', async (req: AuthRequest, res: Response) => {
  const { domain } = req.body;
  if (!domain) {
    res.status(400).json({ error: '请提供域名' });
    return;
  }
  try {
    const info = await queryWhois(domain);
    res.json({ domain, info });
  } catch (err: any) {
    res.status(500).json({ error: err.message || '查询失败' });
  }
});

// Batch whois query
router.post('/batch-whois', async (req: AuthRequest, res: Response) => {
  const { domains } = req.body;
  if (!domains || !Array.isArray(domains) || domains.length === 0) {
    res.status(400).json({ error: '请提供域名列表' });
    return;
  }
  const results = await queryBatchWhois(domains);
  res.json({ results });
});

// Create domain (require domain:add)
router.post('/', requirePermission('domain:add'), async (req: AuthRequest, res: Response) => {
  const { name, registrar, registration_date, expiration_date, purpose, tags, group_id } = req.body;
  if (!name) {
    res.status(400).json({ error: '域名不能为空' });
    return;
  }

  const db = getDb();
  const existing = db.prepare('SELECT id FROM domains WHERE name = ? AND user_id = ?').get(name, req.user!.id);
  if (existing) {
    res.status(409).json({ error: '该域名已存在' });
    return;
  }

  const result = db.prepare(
    'INSERT INTO domains (user_id, group_id, name, registrar, registration_date, expiration_date, purpose, tags) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(req.user!.id, group_id || null, name, registrar || '', registration_date || '', expiration_date || '', purpose || '', tags || '');

  const domain = db.prepare('SELECT * FROM domains WHERE id = ?').get(result.lastInsertRowid);

  // Auto-check SSL in background
  if (domain) {
    checkSsl(name).then(sslInfo => {
      db.prepare('UPDATE domains SET ssl_expiry=?, ssl_issuer=? WHERE id=?')
        .run(sslInfo.expiry, sslInfo.issuer, result.lastInsertRowid);
    }).catch(() => {});
  }

  res.status(201).json({ domain });
});

// Batch create domains
router.post('/batch', requirePermission('domain:add'), async (req: AuthRequest, res: Response) => {
  const { domains } = req.body;
  if (!domains || !Array.isArray(domains)) {
    res.status(400).json({ error: '请提供域名列表' });
    return;
  }

  const db = getDb();
  const insert = db.prepare(
    'INSERT OR IGNORE INTO domains (user_id, group_id, name, registrar, registration_date, expiration_date, purpose, tags) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  );

  const results = [];
  const seen = new Set<string>();
  const cleanName = (name: string) => {
    let s = name.replace(/^https?:\/\//i, '').replace(/[\/:].*$/, '').replace(/\s+/g, '').replace(/[^a-zA-Z0-9.\-_]/g, '').toLowerCase();
    if (!s || !s.includes('.')) return null;
    // Strip subdomain: 123.b.com → b.com
    const parts = s.split('.');
    if (parts.length > 2) s = parts.slice(parts.length - 2).join('.');
    if (seen.has(s)) return null;
    seen.add(s);
    return s;
  };

  for (const d of domains) {
    const name = cleanName(d.name);
    if (!name) {
      results.push({ name: d.name || '(空)', success: false, error: '域名格式无效' });
      continue;
    }
    try {
      const result = insert.run(req.user!.id, d.group_id || null, name, d.registrar || '', d.registration_date || '', d.expiration_date || '', d.purpose || '', d.tags || '');
      results.push({ name: name, success: result.changes > 0 });
    } catch (err: any) {
      results.push({ name: name, success: false, error: err.message });
    }
  }

  // Auto-check SSL for batch (await to ensure data is ready when list loads)
  const sslTasks = results.filter(r => r.success).map(async r => {
    try {
      const row = db.prepare('SELECT id FROM domains WHERE name = ?').get(r.name) as any;
      if (!row) return;
      const sslInfo = await checkSsl(r.name);
      db.prepare('UPDATE domains SET ssl_expiry=?, ssl_issuer=? WHERE id=?')
        .run(sslInfo.expiry, sslInfo.issuer, row.id);
    } catch {}
  });
  // Run with concurrency limit of 5
  async function runConcurrent(tasks: (() => Promise<void>)[], limit: number) {
    const results: Promise<void>[] = [];
    const executing = new Set<Promise<void>>();
    for (const task of tasks) {
      const p = task().finally(() => executing.delete(p));
      results.push(p);
      executing.add(p);
      if (executing.size >= limit) {
        await Promise.race(executing);
      }
    }
    await Promise.allSettled(results);
  }
  const taskList = sslTasks.map(t => () => t);
  await runConcurrent(taskList, 5);

  res.status(201).json({ results });
});

// Update domain (require domain:edit)
router.put('/:id', requirePermission('domain:edit'), (req: AuthRequest, res: Response) => {
  const db = getDb();
  const filter = getCompanyFilter(req);
  const userId = req.user!.id;

  let domain: any;
  if (filter.companyId === null && !filter.needsJoin) {
    domain = db.prepare('SELECT id, user_id FROM domains WHERE id = ?').get(req.params.id);
  } else if (filter.companyId !== null && filter.needsJoin) {
    domain = db.prepare(
      'SELECT d.id, d.user_id FROM domains d LEFT JOIN users u ON d.user_id = u.id WHERE d.id = ? AND u.company_id = ?'
    ).get(req.params.id, filter.companyId);
  } else {
    domain = db.prepare('SELECT id FROM domains WHERE id = ? AND user_id = ?').get(req.params.id, userId);
  }

  if (!domain) {
    res.status(404).json({ error: '域名不存在' });
    return;
  }

  const { registrar, registration_date, expiration_date, purpose, tags, group_id } = req.body;
  db.prepare(
    'UPDATE domains SET registrar=?, registration_date=?, expiration_date=?, purpose=?, tags=?, group_id=?, updated_at=CURRENT_TIMESTAMP WHERE id=?'
  ).run(registrar || '', registration_date || '', expiration_date || '', purpose || '', tags || '', group_id || null, req.params.id);

  const updated = db.prepare('SELECT d.*, dg.name as group_name FROM domains d LEFT JOIN domain_groups dg ON d.group_id = dg.id WHERE d.id = ?').get(req.params.id);
  res.json({ domain: updated });
});

// Delete domain (require domain:delete)
router.delete('/:id', requirePermission('domain:delete'), (req: AuthRequest, res: Response) => {
  const db = getDb();
  const filter = getCompanyFilter(req);
  const userId = req.user!.id;

  let result: any;
  if (filter.companyId === null && !filter.needsJoin) {
    result = db.prepare('DELETE FROM domains WHERE id = ?').run(req.params.id);
  } else if (filter.companyId !== null && filter.needsJoin) {
    result = db.prepare(
      'DELETE FROM domains WHERE id = ? AND user_id IN (SELECT id FROM users WHERE company_id = ?)'
    ).run(req.params.id, filter.companyId);
  } else {
    result = db.prepare('DELETE FROM domains WHERE id = ? AND user_id = ?').run(req.params.id, userId);
  }

  if (result.changes === 0) {
    res.status(404).json({ error: '域名不存在' });
    return;
  }
  res.json({ message: '删除成功' });
});

// Refresh DNS (require domain:refresh-dns)
router.put('/:id/refresh-dns', requirePermission('domain:refresh-dns'), async (req: AuthRequest, res: Response) => {
  const db = getDb();
  const userId = req.user!.id;
  const filter = getCompanyFilter(req);

  let domain: any;
  if (filter.companyId === null && !filter.needsJoin) {
    domain = db.prepare('SELECT name FROM domains WHERE id = ?').get(req.params.id);
  } else if (filter.companyId !== null && filter.needsJoin) {
    domain = db.prepare(
      'SELECT d.name FROM domains d LEFT JOIN users u ON d.user_id = u.id WHERE d.id = ? AND u.company_id = ?'
    ).get(req.params.id, filter.companyId);
  } else {
    domain = db.prepare('SELECT name FROM domains WHERE id = ? AND user_id = ?').get(req.params.id, userId);
  }

  if (!domain) {
    res.status(404).json({ error: '域名不存在' });
    return;
  }

  try {
    const [records, nsRecords] = await Promise.all([
      queryDnsRecords(domain.name),
      queryNsRecords(domain.name),
    ]);
    // Extract NS provider info
    const nsInfo = extractNsInfo(nsRecords);
    db.prepare('UPDATE domains SET dns_records = ?, dns_ns_server = ?, dns_ns_provider = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(JSON.stringify(records), nsInfo?.server || '', nsInfo?.provider || '', req.params.id);
    res.json({ records });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Refresh SSL (require domain:refresh-ssl)
router.put('/:id/refresh-ssl', requirePermission('domain:refresh-ssl'), async (req: AuthRequest, res: Response) => {
  const db = getDb();
  const userId = req.user!.id;
  const filter = getCompanyFilter(req);

  let domain: any;
  if (filter.companyId === null && !filter.needsJoin) {
    domain = db.prepare('SELECT name FROM domains WHERE id = ?').get(req.params.id);
  } else if (filter.companyId !== null && filter.needsJoin) {
    domain = db.prepare(
      'SELECT d.name FROM domains d LEFT JOIN users u ON d.user_id = u.id WHERE d.id = ? AND u.company_id = ?'
    ).get(req.params.id, filter.companyId);
  } else {
    domain = db.prepare('SELECT name FROM domains WHERE id = ? AND user_id = ?').get(req.params.id, userId);
  }

  if (!domain) {
    res.status(404).json({ error: '域名不存在' });
    return;
  }

  try {
    const sslInfo = await checkSsl(domain.name);
    db.prepare('UPDATE domains SET ssl_expiry=?, ssl_issuer=?, updated_at=CURRENT_TIMESTAMP WHERE id=?')
      .run(sslInfo.expiry, sslInfo.issuer, req.params.id);
    res.json({ ssl: sslInfo });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get DNS records (require domain:view)
router.get('/:id/dns', requirePermission('domain:view'), async (req: AuthRequest, res: Response) => {
  const db = getDb();
  const userId = req.user!.id;
  const filter = getCompanyFilter(req);

  let domain: any;
  if (filter.companyId === null && !filter.needsJoin) {
    domain = db.prepare('SELECT name FROM domains WHERE id = ?').get(req.params.id);
  } else if (filter.companyId !== null && filter.needsJoin) {
    domain = db.prepare(
      'SELECT d.name FROM domains d LEFT JOIN users u ON d.user_id = u.id WHERE d.id = ? AND u.company_id = ?'
    ).get(req.params.id, filter.companyId);
  } else {
    domain = db.prepare('SELECT name FROM domains WHERE id = ? AND user_id = ?').get(req.params.id, userId);
  }

  if (!domain) {
    res.status(404).json({ error: '域名不存在' });
    return;
  }
  try {
    const [records, nsRecords] = await Promise.all([
      queryDnsRecords(domain.name),
      queryNsRecords(domain.name),
    ]);
    // Save to database for caching
    const nsInfo = extractNsInfo(nsRecords);
    db.prepare('UPDATE domains SET dns_records = ?, dns_ns_server = ?, dns_ns_provider = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(JSON.stringify(records), nsInfo?.server || '', nsInfo?.provider || '', req.params.id);
    res.json({ records });
  } catch (err: any) {
    // Fall back to cached DNS records
    const cached = db.prepare('SELECT dns_records FROM domains WHERE id = ?').get(req.params.id) as any;
    if (cached?.dns_records) {
      res.json({ records: JSON.parse(cached.dns_records), cached: true });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

// Get SSL info (require domain:view)
router.get('/:id/ssl', requirePermission('domain:view'), async (req: AuthRequest, res: Response) => {
  const db = getDb();
  const userId = req.user!.id;
  const filter = getCompanyFilter(req);

  let domain: any;
  if (filter.companyId === null && !filter.needsJoin) {
    domain = db.prepare('SELECT name FROM domains WHERE id = ?').get(req.params.id);
  } else if (filter.companyId !== null && filter.needsJoin) {
    domain = db.prepare(
      'SELECT d.name FROM domains d LEFT JOIN users u ON d.user_id = u.id WHERE d.id = ? AND u.company_id = ?'
    ).get(req.params.id, filter.companyId);
  } else {
    domain = db.prepare('SELECT name FROM domains WHERE id = ? AND user_id = ?').get(req.params.id, userId);
  }

  if (!domain) {
    res.status(404).json({ error: '域名不存在' });
    return;
  }
  try {
    const sslInfo = await checkSsl(domain.name);
    res.json({ ssl: sslInfo });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Manual expiry check — send Telegram notification
router.post('/check-expiry', async (req: AuthRequest, res: Response) => {
  const result = manualExpiryCheck(req.user!.id);
  if (result.count === 0) {
    res.json({ message: result.message, count: 0 });
  } else {
    res.json({ message: result.message, count: result.count });
  }
});

// Batch refresh all domain info (SSL + Whois + DNS) for current user
router.post('/refresh-all', async (req: AuthRequest, res: Response) => {
  const db = getDb();
  const domains = db.prepare('SELECT id, name FROM domains WHERE user_id = ?').all(req.user!.id) as any[];

  if (domains.length === 0) {
    res.json({ results: [], total: 0, success: 0, failed: 0, message: '没有域名需要更新' });
    return;
  }

  const results: Array<{ name: string; ssl: boolean; whois: boolean; dns: boolean; error?: string }> = [];
  const batchSize = 5;
  let success = 0;
  let failed = 0;

  // Process in batches of 5 (parallel within batch)
  for (let i = 0; i < domains.length; i += batchSize) {
    const batch = domains.slice(i, i + batchSize);
    const tasks = batch.map(async (d: any) => {
      const res: { name: string; ssl: boolean; whois: boolean; dns: boolean; error?: string } = {
        name: d.name, ssl: false, whois: false, dns: false,
      };
      // 1. SSL
      try {
        const sslInfo = await checkSsl(d.name);
        db.prepare('UPDATE domains SET ssl_expiry=?, ssl_issuer=? WHERE id=?')
          .run(sslInfo.expiry, sslInfo.issuer, d.id);
        res.ssl = true;
      } catch {}
      // 2. Whois (expiration + registrar)
      try {
        const whoisInfo = await queryWhois(d.name);
        if (whoisInfo.expiration_date || whoisInfo.registrar) {
          db.prepare('UPDATE domains SET expiration_date=?, registrar=? WHERE id=?')
            .run(whoisInfo.expiration_date || '', whoisInfo.registrar || '', d.id);
        }
        res.whois = true;
      } catch {}
      // 3. DNS (records + NS provider)
      try {
        const [dnsRecords, nsRecords] = await Promise.all([
          queryDnsRecords(d.name),
          queryNsRecords(d.name),
        ]);
        const nsInfo = extractNsInfo(nsRecords);
        db.prepare('UPDATE domains SET dns_records = ?, dns_ns_server = ?, dns_ns_provider = ? WHERE id = ?')
          .run(JSON.stringify(dnsRecords), nsInfo?.server || '', nsInfo?.provider || '', d.id);
        res.dns = true;
      } catch {}
      return res;
    });

    const batchResults = await Promise.allSettled(tasks);
    for (const r of batchResults) {
      if (r.status === 'fulfilled') {
        results.push(r.value);
        if (r.value.ssl || r.value.whois || r.value.dns) success++;
        else failed++;
      } else {
        results.push({ name: 'unknown', ssl: false, whois: false, dns: false, error: r.reason?.message });
        failed++;
      }
    }
  }

  res.json({
    results,
    total: domains.length,
    success,
    failed,
    message: `检测完成：成功 ${success}，失败 ${failed}，共 ${domains.length} 个域名`,
  });
});

// Configure multer for file upload (store in memory)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];
    // Also allow by extension
    const ext = file.originalname.split('.').pop()?.toLowerCase();
    if (allowed.includes(file.mimetype) || ['csv', 'xls', 'xlsx'].includes(ext || '')) {
      cb(null, true);
    } else {
      cb(new Error('仅支持 CSV/Excel 文件 (.csv / .xls / .xlsx)'));
    }
  },
});

// Batch upload domains from Excel/CSV file
router.post('/batch-upload', requirePermission('domain:add'), upload.single('file'), (req: AuthRequest, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: '请上传文件' });
    return;
  }

  const db = getDb();
  const userId = req.user!.id;
  let rows: any[];

  try {
    const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = wb.SheetNames[0];
    const sheet = wb.Sheets[sheetName];
    rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  } catch (err: any) {
    res.status(400).json({ error: '文件解析失败：' + err.message });
    return;
  }

  if (rows.length < 2) {
    res.status(400).json({ error: '文件至少需要包含表头和数据行' });
    return;
  }

  // Skip header row
  const dataRows = rows.slice(1).filter((r: any) => r[0] && String(r[0]).trim());
  if (dataRows.length === 0) {
    res.status(400).json({ error: '无有效数据行' });
    return;
  }

  const results: Array<{ domain: string; purpose: string; group: string; success: boolean; error?: string }> = [];
  const seen = new Set<string>();
  const insert = db.prepare(
    'INSERT OR IGNORE INTO domains (user_id, group_id, name, purpose) VALUES (?, ?, ?, ?)'
  );

  const cleanDomain = (name: string) => {
    let s = name.replace(/^https?:\/\//i, '').replace(/[\/:].*$/, '').replace(/\s+/g, '').replace(/[^a-zA-Z0-9.\-_]/g, '').toLowerCase();
    if (!s || !s.includes('.')) return null;
    const parts = s.split('.');
    if (parts.length > 2) s = parts.slice(parts.length - 2).join('.');
    return s;
  };

  const defaultGroupId = getOrCreateDefaultGroup(userId);

  for (const row of dataRows) {
    const rawDomain = String(row[0] || '').trim();
    const purpose = String(row[1] || '').trim();
    const groupName = String(row[2] || '').trim();

    const domain = cleanDomain(rawDomain);
    if (!domain) {
      results.push({ domain: rawDomain || '(空)', purpose, group: groupName, success: false, error: '格式无效' });
      continue;
    }
    if (seen.has(domain)) {
      results.push({ domain, purpose, group: groupName, success: false, error: '重复域名' });
      continue;
    }
    seen.add(domain);

    // Determine group: match by name → create if not exists → default
    let groupId = defaultGroupId;
    if (groupName) {
      try {
        groupId = getOrCreateGroup(userId, groupName);
      } catch {
        // fallback to default
      }
    }

    try {
      const result = insert.run(userId, groupId, domain, purpose);
      if (result.changes > 0) {
        results.push({ domain, purpose, group: groupName, success: true });
      } else {
        results.push({ domain, purpose, group: groupName, success: false, error: '域名已存在' });
      }
    } catch (err: any) {
      results.push({ domain, purpose, group: groupName, success: false, error: err.message });
    }
  }

  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;

  res.json({
    results,
    total: results.length,
    success: successCount,
    failed: failCount,
    message: `导入完成：成功 ${successCount}，失败 ${failCount}，共 ${results.length} 条`,
  });
});

// Batch assign group
router.post('/batch-group', requirePermission('domain:edit'), (req: AuthRequest, res: Response) => {
  const { ids, group_id } = req.body;
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    res.status(400).json({ error: '请提供域名 ID 列表' });
    return;
  }

  const db = getDb();
  const filter = getCompanyFilter(req);
  let count = 0;

  for (const id of ids) {
    let sql = 'UPDATE domains SET group_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
    const params: any[] = [group_id || null, id];

    if (filter.companyId !== null && filter.needsJoin) {
      sql += ' AND user_id IN (SELECT id FROM users WHERE company_id = ?)';
      params.push(filter.companyId);
    } else if (!filter.needsJoin && filter.companyId === null) {
      // super_admin — no extra filter
    } else {
      sql += ' AND user_id = ?';
      params.push(req.user!.id);
    }

    const result = db.prepare(sql).run(...params);
    count += result.changes;
  }

  res.json({ updated: count, message: `已更新 ${count} 个域名的分组` });
});

export default router;

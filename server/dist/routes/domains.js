"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../db");
const auth_1 = require("../middleware/auth");
const permission_1 = require("../middleware/permission");
const whois_1 = require("../services/whois");
const dns_1 = require("../services/dns");
const ssl_1 = require("../services/ssl");
const reminder_1 = require("../services/reminder");
const router = (0, express_1.Router)();
router.use(auth_1.authMiddleware);
// List domains
router.get('/', (req, res) => {
    const db = (0, db_1.getDb)();
    const { search, group_id, sort_by, sort_order, page = '1', page_size = '20' } = req.query;
    const filter = (0, permission_1.getCompanyFilter)(req);
    const userId = req.user.id;
    let sql;
    let params;
    if (filter.companyId === null && !filter.needsJoin) {
        // super_admin — see all domains
        sql = 'SELECT d.*, dg.name as group_name, u.username, c.name as company_name FROM domains d LEFT JOIN domain_groups dg ON d.group_id = dg.id LEFT JOIN users u ON d.user_id = u.id LEFT JOIN companies c ON u.company_id = c.id WHERE 1=1';
        params = [];
    }
    else if (filter.companyId !== null && filter.needsJoin) {
        // company_admin or user — join users to filter by company
        sql = 'SELECT d.*, dg.name as group_name, u.username, c.name as company_name FROM domains d LEFT JOIN domain_groups dg ON d.group_id = dg.id LEFT JOIN users u ON d.user_id = u.id LEFT JOIN companies c ON u.company_id = c.id WHERE u.company_id = ?';
        params = [filter.companyId];
    }
    else {
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
    const total = db.prepare(countSql).get(...params).total;
    // Sort
    const allowedSort = ['name', 'expiration_date', 'created_at', 'registrar'];
    const sort = allowedSort.includes(sort_by) ? sort_by : 'created_at';
    const order = sort_order === 'asc' ? 'ASC' : 'DESC';
    sql += ` ORDER BY d.${sort} ${order}`;
    // Paginate
    const p = Math.max(1, Number(page));
    const ps = Math.min(100, Math.max(1, Number(page_size)));
    sql += ' LIMIT ? OFFSET ?';
    params.push(ps, (p - 1) * ps);
    const domains = db.prepare(sql).all(...params);
    res.json({ domains, total, page: p, page_size: ps });
});
// Get single domain
router.get('/:id', (req, res) => {
    const db = (0, db_1.getDb)();
    const filter = (0, permission_1.getCompanyFilter)(req);
    const userId = req.user.id;
    let domain;
    if (filter.companyId === null && !filter.needsJoin) {
        // super_admin — can access any domain
        domain = db.prepare('SELECT d.*, dg.name as group_name, u.username FROM domains d LEFT JOIN domain_groups dg ON d.group_id = dg.id LEFT JOIN users u ON d.user_id = u.id WHERE d.id = ?').get(req.params.id);
    }
    else if (filter.companyId !== null && filter.needsJoin) {
        domain = db.prepare('SELECT d.*, dg.name as group_name, u.username FROM domains d LEFT JOIN domain_groups dg ON d.group_id = dg.id LEFT JOIN users u ON d.user_id = u.id WHERE d.id = ? AND u.company_id = ?').get(req.params.id, filter.companyId);
    }
    else {
        domain = db.prepare('SELECT d.*, dg.name as group_name FROM domains d LEFT JOIN domain_groups dg ON d.group_id = dg.id WHERE d.id = ? AND d.user_id = ?').get(req.params.id, userId);
    }
    if (!domain) {
        res.status(404).json({ error: '域名不存在' });
        return;
    }
    res.json({ domain });
});
// Query whois (not save)
router.post('/whois', async (req, res) => {
    const { domain } = req.body;
    if (!domain) {
        res.status(400).json({ error: '请提供域名' });
        return;
    }
    try {
        const info = await (0, whois_1.queryWhois)(domain);
        res.json({ domain, info });
    }
    catch (err) {
        res.status(500).json({ error: err.message || '查询失败' });
    }
});
// Batch whois query
router.post('/batch-whois', async (req, res) => {
    const { domains } = req.body;
    if (!domains || !Array.isArray(domains) || domains.length === 0) {
        res.status(400).json({ error: '请提供域名列表' });
        return;
    }
    const results = await (0, whois_1.queryBatchWhois)(domains);
    res.json({ results });
});
// Create domain (require domain:add)
router.post('/', (0, permission_1.requirePermission)('domain:add'), async (req, res) => {
    const { name, registrar, registration_date, expiration_date, purpose, tags, group_id } = req.body;
    if (!name) {
        res.status(400).json({ error: '域名不能为空' });
        return;
    }
    const db = (0, db_1.getDb)();
    const existing = db.prepare('SELECT id FROM domains WHERE name = ? AND user_id = ?').get(name, req.user.id);
    if (existing) {
        res.status(409).json({ error: '该域名已存在' });
        return;
    }
    const result = db.prepare('INSERT INTO domains (user_id, group_id, name, registrar, registration_date, expiration_date, purpose, tags) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(req.user.id, group_id || null, name, registrar || '', registration_date || '', expiration_date || '', purpose || '', tags || '');
    const domain = db.prepare('SELECT * FROM domains WHERE id = ?').get(result.lastInsertRowid);
    // Auto-check SSL in background
    if (domain) {
        (0, ssl_1.checkSsl)(name).then(sslInfo => {
            db.prepare('UPDATE domains SET ssl_expiry=?, ssl_issuer=? WHERE id=?')
                .run(sslInfo.expiry, sslInfo.issuer, result.lastInsertRowid);
        }).catch(() => { });
    }
    res.status(201).json({ domain });
});
// Batch create domains
router.post('/batch', (0, permission_1.requirePermission)('domain:add'), async (req, res) => {
    const { domains } = req.body;
    if (!domains || !Array.isArray(domains)) {
        res.status(400).json({ error: '请提供域名列表' });
        return;
    }
    const db = (0, db_1.getDb)();
    const insert = db.prepare('INSERT OR IGNORE INTO domains (user_id, group_id, name, registrar, registration_date, expiration_date, purpose, tags) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    const results = [];
    const seen = new Set();
    const cleanName = (name) => {
        let s = name.replace(/^https?:\/\//i, '').replace(/[\/:].*$/, '').replace(/\s+/g, '').replace(/[^a-zA-Z0-9.\-_]/g, '').toLowerCase();
        if (!s || !s.includes('.'))
            return null;
        // Strip subdomain: 123.b.com → b.com
        const parts = s.split('.');
        if (parts.length > 2)
            s = parts.slice(parts.length - 2).join('.');
        if (seen.has(s))
            return null;
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
            const result = insert.run(req.user.id, d.group_id || null, name, d.registrar || '', d.registration_date || '', d.expiration_date || '', d.purpose || '', d.tags || '');
            results.push({ name: name, success: result.changes > 0 });
        }
        catch (err) {
            results.push({ name: name, success: false, error: err.message });
        }
    }
    // Auto-check SSL for batch (await to ensure data is ready when list loads)
    const sslTasks = results.filter(r => r.success).map(async (r) => {
        try {
            const row = db.prepare('SELECT id FROM domains WHERE name = ?').get(r.name);
            if (!row)
                return;
            const sslInfo = await (0, ssl_1.checkSsl)(r.name);
            db.prepare('UPDATE domains SET ssl_expiry=?, ssl_issuer=? WHERE id=?')
                .run(sslInfo.expiry, sslInfo.issuer, row.id);
        }
        catch { }
    });
    // Run with concurrency limit of 5
    async function runConcurrent(tasks, limit) {
        const results = [];
        const executing = new Set();
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
router.put('/:id', (0, permission_1.requirePermission)('domain:edit'), (req, res) => {
    const db = (0, db_1.getDb)();
    const filter = (0, permission_1.getCompanyFilter)(req);
    const userId = req.user.id;
    let domain;
    if (filter.companyId === null && !filter.needsJoin) {
        domain = db.prepare('SELECT id, user_id FROM domains WHERE id = ?').get(req.params.id);
    }
    else if (filter.companyId !== null && filter.needsJoin) {
        domain = db.prepare('SELECT d.id, d.user_id FROM domains d LEFT JOIN users u ON d.user_id = u.id WHERE d.id = ? AND u.company_id = ?').get(req.params.id, filter.companyId);
    }
    else {
        domain = db.prepare('SELECT id FROM domains WHERE id = ? AND user_id = ?').get(req.params.id, userId);
    }
    if (!domain) {
        res.status(404).json({ error: '域名不存在' });
        return;
    }
    const { registrar, registration_date, expiration_date, purpose, tags, group_id } = req.body;
    db.prepare('UPDATE domains SET registrar=?, registration_date=?, expiration_date=?, purpose=?, tags=?, group_id=?, updated_at=CURRENT_TIMESTAMP WHERE id=?').run(registrar || '', registration_date || '', expiration_date || '', purpose || '', tags || '', group_id || null, req.params.id);
    const updated = db.prepare('SELECT d.*, dg.name as group_name FROM domains d LEFT JOIN domain_groups dg ON d.group_id = dg.id WHERE d.id = ?').get(req.params.id);
    res.json({ domain: updated });
});
// Delete domain (require domain:delete)
router.delete('/:id', (0, permission_1.requirePermission)('domain:delete'), (req, res) => {
    const db = (0, db_1.getDb)();
    const filter = (0, permission_1.getCompanyFilter)(req);
    const userId = req.user.id;
    let result;
    if (filter.companyId === null && !filter.needsJoin) {
        result = db.prepare('DELETE FROM domains WHERE id = ?').run(req.params.id);
    }
    else if (filter.companyId !== null && filter.needsJoin) {
        result = db.prepare('DELETE FROM domains WHERE id = ? AND user_id IN (SELECT id FROM users WHERE company_id = ?)').run(req.params.id, filter.companyId);
    }
    else {
        result = db.prepare('DELETE FROM domains WHERE id = ? AND user_id = ?').run(req.params.id, userId);
    }
    if (result.changes === 0) {
        res.status(404).json({ error: '域名不存在' });
        return;
    }
    res.json({ message: '删除成功' });
});
// Refresh DNS (require domain:refresh-dns)
router.put('/:id/refresh-dns', (0, permission_1.requirePermission)('domain:refresh-dns'), async (req, res) => {
    const db = (0, db_1.getDb)();
    const userId = req.user.id;
    const filter = (0, permission_1.getCompanyFilter)(req);
    let domain;
    if (filter.companyId === null && !filter.needsJoin) {
        domain = db.prepare('SELECT name FROM domains WHERE id = ?').get(req.params.id);
    }
    else if (filter.companyId !== null && filter.needsJoin) {
        domain = db.prepare('SELECT d.name FROM domains d LEFT JOIN users u ON d.user_id = u.id WHERE d.id = ? AND u.company_id = ?').get(req.params.id, filter.companyId);
    }
    else {
        domain = db.prepare('SELECT name FROM domains WHERE id = ? AND user_id = ?').get(req.params.id, userId);
    }
    if (!domain) {
        res.status(404).json({ error: '域名不存在' });
        return;
    }
    try {
        const records = await (0, dns_1.queryDnsRecords)(domain.name);
        db.prepare('UPDATE domains SET dns_records = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
            .run(JSON.stringify(records), req.params.id);
        res.json({ records });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Refresh SSL (require domain:refresh-ssl)
router.put('/:id/refresh-ssl', (0, permission_1.requirePermission)('domain:refresh-ssl'), async (req, res) => {
    const db = (0, db_1.getDb)();
    const userId = req.user.id;
    const filter = (0, permission_1.getCompanyFilter)(req);
    let domain;
    if (filter.companyId === null && !filter.needsJoin) {
        domain = db.prepare('SELECT name FROM domains WHERE id = ?').get(req.params.id);
    }
    else if (filter.companyId !== null && filter.needsJoin) {
        domain = db.prepare('SELECT d.name FROM domains d LEFT JOIN users u ON d.user_id = u.id WHERE d.id = ? AND u.company_id = ?').get(req.params.id, filter.companyId);
    }
    else {
        domain = db.prepare('SELECT name FROM domains WHERE id = ? AND user_id = ?').get(req.params.id, userId);
    }
    if (!domain) {
        res.status(404).json({ error: '域名不存在' });
        return;
    }
    try {
        const sslInfo = await (0, ssl_1.checkSsl)(domain.name);
        db.prepare('UPDATE domains SET ssl_expiry=?, ssl_issuer=?, updated_at=CURRENT_TIMESTAMP WHERE id=?')
            .run(sslInfo.expiry, sslInfo.issuer, req.params.id);
        res.json({ ssl: sslInfo });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Get DNS records (require domain:view)
router.get('/:id/dns', (0, permission_1.requirePermission)('domain:view'), async (req, res) => {
    const db = (0, db_1.getDb)();
    const userId = req.user.id;
    const filter = (0, permission_1.getCompanyFilter)(req);
    let domain;
    if (filter.companyId === null && !filter.needsJoin) {
        domain = db.prepare('SELECT name FROM domains WHERE id = ?').get(req.params.id);
    }
    else if (filter.companyId !== null && filter.needsJoin) {
        domain = db.prepare('SELECT d.name FROM domains d LEFT JOIN users u ON d.user_id = u.id WHERE d.id = ? AND u.company_id = ?').get(req.params.id, filter.companyId);
    }
    else {
        domain = db.prepare('SELECT name FROM domains WHERE id = ? AND user_id = ?').get(req.params.id, userId);
    }
    if (!domain) {
        res.status(404).json({ error: '域名不存在' });
        return;
    }
    try {
        const records = await (0, dns_1.queryDnsRecords)(domain.name);
        // Save to database for caching
        db.prepare('UPDATE domains SET dns_records = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
            .run(JSON.stringify(records), req.params.id);
        res.json({ records });
    }
    catch (err) {
        // Fall back to cached DNS records
        const cached = db.prepare('SELECT dns_records FROM domains WHERE id = ?').get(req.params.id);
        if (cached?.dns_records) {
            res.json({ records: JSON.parse(cached.dns_records), cached: true });
        }
        else {
            res.status(500).json({ error: err.message });
        }
    }
});
// Get SSL info (require domain:view)
router.get('/:id/ssl', (0, permission_1.requirePermission)('domain:view'), async (req, res) => {
    const db = (0, db_1.getDb)();
    const userId = req.user.id;
    const filter = (0, permission_1.getCompanyFilter)(req);
    let domain;
    if (filter.companyId === null && !filter.needsJoin) {
        domain = db.prepare('SELECT name FROM domains WHERE id = ?').get(req.params.id);
    }
    else if (filter.companyId !== null && filter.needsJoin) {
        domain = db.prepare('SELECT d.name FROM domains d LEFT JOIN users u ON d.user_id = u.id WHERE d.id = ? AND u.company_id = ?').get(req.params.id, filter.companyId);
    }
    else {
        domain = db.prepare('SELECT name FROM domains WHERE id = ? AND user_id = ?').get(req.params.id, userId);
    }
    if (!domain) {
        res.status(404).json({ error: '域名不存在' });
        return;
    }
    try {
        const sslInfo = await (0, ssl_1.checkSsl)(domain.name);
        res.json({ ssl: sslInfo });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Manual expiry check — send Telegram notification
router.post('/check-expiry', async (req, res) => {
    const result = (0, reminder_1.manualExpiryCheck)(req.user.id);
    if (result.count === 0) {
        res.json({ message: result.message, count: 0 });
    }
    else {
        res.json({ message: result.message, count: result.count });
    }
});
// Batch refresh all domain info (SSL + Whois + DNS) for current user
router.post('/refresh-all', async (req, res) => {
    const db = (0, db_1.getDb)();
    const domains = db.prepare('SELECT id, name FROM domains WHERE user_id = ?').all(req.user.id);
    if (domains.length === 0) {
        res.json({ results: [], total: 0, success: 0, failed: 0, message: '没有域名需要更新' });
        return;
    }
    const results = [];
    const batchSize = 5;
    let success = 0;
    let failed = 0;
    // Process in batches of 5 (parallel within batch)
    for (let i = 0; i < domains.length; i += batchSize) {
        const batch = domains.slice(i, i + batchSize);
        const tasks = batch.map(async (d) => {
            const res = {
                name: d.name, ssl: false, whois: false, dns: false,
            };
            // 1. SSL
            try {
                const sslInfo = await (0, ssl_1.checkSsl)(d.name);
                db.prepare('UPDATE domains SET ssl_expiry=?, ssl_issuer=? WHERE id=?')
                    .run(sslInfo.expiry, sslInfo.issuer, d.id);
                res.ssl = true;
            }
            catch { }
            // 2. Whois (expiration + registrar)
            try {
                const whoisInfo = await (0, whois_1.queryWhois)(d.name);
                if (whoisInfo.expiration_date || whoisInfo.registrar) {
                    db.prepare('UPDATE domains SET expiration_date=?, registrar=? WHERE id=?')
                        .run(whoisInfo.expiration_date || '', whoisInfo.registrar || '', d.id);
                }
                res.whois = true;
            }
            catch { }
            // 3. DNS
            try {
                const dnsRecords = await (0, dns_1.queryDnsRecords)(d.name);
                db.prepare('UPDATE domains SET dns_records = ? WHERE id = ?')
                    .run(JSON.stringify(dnsRecords), d.id);
                res.dns = true;
            }
            catch { }
            return res;
        });
        const batchResults = await Promise.allSettled(tasks);
        for (const r of batchResults) {
            if (r.status === 'fulfilled') {
                results.push(r.value);
                if (r.value.ssl || r.value.whois || r.value.dns)
                    success++;
                else
                    failed++;
            }
            else {
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
// Batch assign group
router.post('/batch-group', (0, permission_1.requirePermission)('domain:edit'), (req, res) => {
    const { ids, group_id } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
        res.status(400).json({ error: '请提供域名 ID 列表' });
        return;
    }
    const db = (0, db_1.getDb)();
    const filter = (0, permission_1.getCompanyFilter)(req);
    let count = 0;
    for (const id of ids) {
        let sql = 'UPDATE domains SET group_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
        const params = [group_id || null, id];
        if (filter.companyId !== null && filter.needsJoin) {
            sql += ' AND user_id IN (SELECT id FROM users WHERE company_id = ?)';
            params.push(filter.companyId);
        }
        else if (!filter.needsJoin && filter.companyId === null) {
            // super_admin — no extra filter
        }
        else {
            sql += ' AND user_id = ?';
            params.push(req.user.id);
        }
        const result = db.prepare(sql).run(...params);
        count += result.changes;
    }
    res.json({ updated: count, message: `已更新 ${count} 个域名的分组` });
});
exports.default = router;
//# sourceMappingURL=domains.js.map
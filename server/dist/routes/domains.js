"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.refreshAllStreamHandler = void 0;
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const XLSX = __importStar(require("xlsx"));
const db_1 = require("../db");
const auth_1 = require("../middleware/auth");
const permission_1 = require("../middleware/permission");
const whois_1 = require("../services/whois");
const dns_1 = require("../services/dns");
const ssl_1 = require("../services/ssl");
const reminder_1 = require("../services/reminder");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const router = (0, express_1.Router)();
router.use(auth_1.authMiddleware);
// List available DNS providers for filter dropdown
router.get('/ns-providers', (req, res) => {
    const db = (0, db_1.getDb)();
    const providers = db.prepare("SELECT DISTINCT dns_ns_provider FROM domains WHERE dns_ns_provider != '' AND dns_ns_provider IS NOT NULL ORDER BY dns_ns_provider").all();
    res.json({ providers: providers.map((r) => r.dns_ns_provider) });
});
// List domains
router.get('/', (req, res) => {
    const db = (0, db_1.getDb)();
    const { search, group_id, ns_provider, ns_server, sort_by, sort_order, page = '1', page_size = '20' } = req.query;
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
    if (ns_provider) {
        sql += ' AND d.dns_ns_provider = ?';
        params.push(ns_provider);
    }
    if (ns_server) {
        sql += ' AND d.dns_ns_server LIKE ?';
        params.push(`%${ns_server}%`);
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
    // Don't need to parse dns_records for NS info anymore;
    // dns_ns_server and dns_ns_provider are stored as DB columns.
    const domains = db.prepare(sql).all(...params).map((d) => {
        // Backfill: if NS info is missing but dns_records exists, try to extract
        if (!d.dns_ns_server && d.dns_records && d.dns_records.length > 2) {
            try {
                const records = JSON.parse(d.dns_records);
                const nsInfo = (0, dns_1.extractNsInfo)(records);
                if (nsInfo) {
                    d.dns_ns_server = nsInfo.server;
                    d.dns_ns_provider = nsInfo.provider || '';
                    // Save to DB for future reads
                    db.prepare('UPDATE domains SET dns_ns_server = ?, dns_ns_provider = ? WHERE id = ?')
                        .run(nsInfo.server, nsInfo.provider || '', d.id);
                }
            }
            catch { /* ignore parse errors */ }
        }
        return d;
    });
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
    (0, db_1.logOperation)(req.user.id, req.user.username, 'create', 'domain', domain.id, name);
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
    const successNames = results.filter(r => r.success).map(r => r.name);
    if (successNames.length > 0) {
        (0, db_1.logOperation)(req.user.id, req.user.username, 'create', 'domain', undefined, successNames.join(', '), `批量创建 ${successNames.length} 个域名`);
    }
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
    (0, db_1.logOperation)(req.user.id, req.user.username, 'update', 'domain', updated.id, updated.name);
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
    (0, db_1.logOperation)(req.user.id, req.user.username, 'delete', 'domain', Number(req.params.id), undefined, '删除域名');
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
        const [records, nsRecords] = await Promise.all([
            (0, dns_1.queryDnsRecords)(domain.name),
            (0, dns_1.queryNsRecords)(domain.name),
        ]);
        // Extract NS provider info
        const nsInfo = (0, dns_1.extractNsInfo)(nsRecords);
        db.prepare('UPDATE domains SET dns_records = ?, dns_ns_server = ?, dns_ns_provider = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
            .run(JSON.stringify(records), nsInfo?.server || '', nsInfo?.provider || '', req.params.id);
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
// Get DNS records from DB cache (require domain:view)
router.get('/:id/dns', (0, permission_1.requirePermission)('domain:view'), async (req, res) => {
    const db = (0, db_1.getDb)();
    const cached = db.prepare('SELECT dns_records FROM domains WHERE id = ?').get(req.params.id);
    if (cached?.dns_records) {
        try {
            res.json({ records: JSON.parse(cached.dns_records) });
        }
        catch {
            res.json({ records: [] });
        }
    }
    else {
        res.json({ records: [] });
    }
});
// Get SSL info from DB cache (require domain:view)
router.get('/:id/ssl', (0, permission_1.requirePermission)('domain:view'), async (req, res) => {
    const db = (0, db_1.getDb)();
    const domain = db.prepare('SELECT ssl_expiry, ssl_issuer FROM domains WHERE id = ?').get(req.params.id);
    if (!domain) {
        res.status(404).json({ error: '域名不存在' });
        return;
    }
    const ssl = domain.ssl_expiry ? {
        expiry: domain.ssl_expiry,
        issuer: domain.ssl_issuer || '',
        valid: new Date(domain.ssl_expiry).getTime() > Date.now(),
        days_remaining: Math.ceil((new Date(domain.ssl_expiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
    } : null;
    res.json({ ssl });
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
// Batch refresh all domain info (SSE streaming for real-time progress)
// NOTE: This route is registered BEFORE authMiddleware in index.ts to allow query-param token
const refreshAllStreamHandler = async (req, res) => {
    // Token from query param (EventSource doesn't support custom headers)
    const token = req.query.token;
    if (!token) {
        res.status(401).json({ error: '未提供认证令牌' });
        return;
    }
    let userId;
    try {
        const JWT_SECRET = process.env.JWT_SECRET || 'domain-keeper-secret-key-change-in-production';
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        userId = decoded.id;
    }
    catch {
        res.status(401).json({ error: '登录已过期' });
        return;
    }
    const db = (0, db_1.getDb)();
    const domains = db.prepare('SELECT id, name FROM domains WHERE user_id = ?').all(userId);
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
    });
    if (domains.length === 0) {
        res.write(`data: ${JSON.stringify({ completed: true, total: 0, success: 0, failed: 0 })}\n\n`);
        res.end();
        return;
    }
    let success = 0;
    let failed = 0;
    const total = domains.length;
    const batchSize = 5;
    let done = 0;
    for (let i = 0; i < domains.length; i += batchSize) {
        const batch = domains.slice(i, i + batchSize);
        const tasks = batch.map(async (d) => {
            const result = { domain: d.name, ssl: false, whois: false, dns: false };
            // SSL
            try {
                const sslInfo = await (0, ssl_1.checkSsl)(d.name);
                db.prepare('UPDATE domains SET ssl_expiry=?, ssl_issuer=? WHERE id=?')
                    .run(sslInfo.expiry, sslInfo.issuer, d.id);
                result.ssl = true;
            }
            catch { }
            // Whois
            try {
                const whoisInfo = await (0, whois_1.queryWhois)(d.name);
                if (whoisInfo.expiration_date || whoisInfo.registrar) {
                    db.prepare('UPDATE domains SET expiration_date=?, registrar=? WHERE id=?')
                        .run(whoisInfo.expiration_date || '', whoisInfo.registrar || '', d.id);
                }
                result.whois = true;
            }
            catch { }
            // DNS
            try {
                const [dnsRecords, nsRecords] = await Promise.all([
                    (0, dns_1.queryDnsRecords)(d.name),
                    (0, dns_1.queryNsRecords)(d.name),
                ]);
                const nsInfo = (0, dns_1.extractNsInfo)(nsRecords);
                db.prepare('UPDATE domains SET dns_records = ?, dns_ns_server = ?, dns_ns_provider = ? WHERE id = ?')
                    .run(JSON.stringify(dnsRecords), nsInfo?.server || '', nsInfo?.provider || '', d.id);
                result.dns = true;
            }
            catch { }
            if (result.ssl || result.whois || result.dns)
                success++;
            else
                failed++;
            result.success = result.ssl || result.whois || result.dns;
            done++;
            result.done = done;
            result.total = total;
            res.write(`data: ${JSON.stringify(result)}\n\n`);
        });
        await Promise.all(tasks);
    }
    res.write(`data: ${JSON.stringify({ completed: true, total, success, failed })}\n\n`);
    res.end();
};
exports.refreshAllStreamHandler = refreshAllStreamHandler;
// Batch refresh all domain info (legacy — kept for backward compat)
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
            // 3. DNS (records + NS provider)
            try {
                const [dnsRecords, nsRecords] = await Promise.all([
                    (0, dns_1.queryDnsRecords)(d.name),
                    (0, dns_1.queryNsRecords)(d.name),
                ]);
                const nsInfo = (0, dns_1.extractNsInfo)(nsRecords);
                db.prepare('UPDATE domains SET dns_records = ?, dns_ns_server = ?, dns_ns_provider = ? WHERE id = ?')
                    .run(JSON.stringify(dnsRecords), nsInfo?.server || '', nsInfo?.provider || '', d.id);
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
    if (success > 0) {
        (0, db_1.logOperation)(req.user.id, req.user.username, 'update', 'domain', undefined, undefined, `批量刷新 ${success} 个域名的信息`);
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
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
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
        }
        else {
            cb(new Error('仅支持 CSV/Excel 文件 (.csv / .xls / .xlsx)'));
        }
    },
});
// Batch upload domains from Excel/CSV file
router.post('/batch-upload', (0, permission_1.requirePermission)('domain:add'), upload.single('file'), (req, res) => {
    if (!req.file) {
        res.status(400).json({ error: '请上传文件' });
        return;
    }
    const db = (0, db_1.getDb)();
    const userId = req.user.id;
    let rows;
    try {
        const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
        const sheetName = wb.SheetNames[0];
        const sheet = wb.Sheets[sheetName];
        rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    }
    catch (err) {
        res.status(400).json({ error: '文件解析失败：' + err.message });
        return;
    }
    if (rows.length < 2) {
        res.status(400).json({ error: '文件至少需要包含表头和数据行' });
        return;
    }
    // Skip header row
    const dataRows = rows.slice(1).filter((r) => r[0] && String(r[0]).trim());
    if (dataRows.length === 0) {
        res.status(400).json({ error: '无有效数据行' });
        return;
    }
    const results = [];
    const seen = new Set();
    const insert = db.prepare('INSERT OR IGNORE INTO domains (user_id, group_id, name, purpose) VALUES (?, ?, ?, ?)');
    const cleanDomain = (name) => {
        let s = name.replace(/^https?:\/\//i, '').replace(/[\/:].*$/, '').replace(/\s+/g, '').replace(/[^a-zA-Z0-9.\-_]/g, '').toLowerCase();
        if (!s || !s.includes('.'))
            return null;
        const parts = s.split('.');
        if (parts.length > 2)
            s = parts.slice(parts.length - 2).join('.');
        return s;
    };
    const defaultGroupId = (0, db_1.getOrCreateDefaultGroup)(userId);
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
                groupId = (0, db_1.getOrCreateGroup)(userId, groupName);
            }
            catch {
                // fallback to default
            }
        }
        try {
            const result = insert.run(userId, groupId, domain, purpose);
            if (result.changes > 0) {
                results.push({ domain, purpose, group: groupName, success: true });
            }
            else {
                results.push({ domain, purpose, group: groupName, success: false, error: '域名已存在' });
            }
        }
        catch (err) {
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
// Check domain availability (DNS + Whois dual-check)
router.post('/check-available', async (req, res) => {
    const { domains } = req.body;
    if (!domains || !Array.isArray(domains) || domains.length === 0) {
        res.status(400).json({ error: '请提供域名列表' });
        return;
    }
    const results = [];
    for (const d of domains.slice(0, 20)) {
        // Step 1: Check DNS (fast) — NS records = definitely registered
        try {
            const nsRecords = await (0, dns_1.queryNsRecords)(d);
            if (nsRecords.length > 0) {
                results.push({ domain: d, available: false, method: 'dns', registrar: nsRecords[0].data });
                continue;
            }
        }
        catch { }
        // Step 2: Check Whois (RDAP) — if returns data = registered
        try {
            const info = await (0, whois_1.queryWhois)(d);
            results.push({
                domain: d,
                available: false,
                method: 'whois',
                registrar: info.registrar || undefined,
                expiration_date: info.expiration_date || undefined,
            });
        }
        catch {
            // Both DNS and Whois failed → likely available (but not 100% guaranteed)
            results.push({ domain: d, available: null, method: 'unknown' });
        }
    }
    const summary = {
        registered: results.filter(r => r.available === false).length,
        likely_available: results.filter(r => r.available === null).length,
    };
    res.json({ results, summary });
});
// Batch assign group (LINE REPLACED BELOW)
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
    if (count > 0) {
        (0, db_1.logOperation)(req.user.id, req.user.username, 'update', 'domain', undefined, undefined, `批量修改 ${count} 个域名的分组`);
    }
    res.json({ updated: count, message: `已更新 ${count} 个域名的分组` });
});
exports.default = router;
//# sourceMappingURL=domains.js.map
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const node_cron_1 = __importDefault(require("node-cron"));
const db_1 = require("./db");
const auth_1 = __importDefault(require("./routes/auth"));
const domains_1 = __importDefault(require("./routes/domains"));
const groups_1 = __importDefault(require("./routes/groups"));
const settings_1 = __importDefault(require("./routes/settings"));
const companies_1 = __importDefault(require("./routes/companies"));
const dashboard_1 = __importDefault(require("./routes/dashboard"));
const dns_providers_1 = __importDefault(require("./routes/dns-providers"));
const telegram_1 = require("./services/telegram");
const reminder_1 = require("./services/reminder");
const dns_1 = require("./services/dns");
const app = (0, express_1.default)();
const PORT = 3001;
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Request logger
app.use((req, _res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    if (req.method === 'POST' && req.path.includes('batch')) {
        console.log('  body:', JSON.stringify(req.body).slice(0, 300));
    }
    next();
});
// Routes
app.use('/api/auth', auth_1.default);
app.use('/api/domains', domains_1.default);
app.use('/api/groups', groups_1.default);
app.use('/api/settings', settings_1.default);
app.use('/api/companies', companies_1.default);
app.use('/api/dashboard', dashboard_1.default);
app.use('/api/dns-providers', dns_providers_1.default);
// Health check
app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
});
// 域名到期提醒 — 每天 9:00 北京时间（UTC+8）= 01:00 UTC
node_cron_1.default.schedule('0 1 * * *', () => {
    (0, reminder_1.checkExpirationReminders)();
});
// Daily report at 12:00 Beijing time (UTC+8) = 04:00 UTC
node_cron_1.default.schedule('0 4 * * *', () => {
    const db = (0, db_1.getDb)();
    const users = db.prepare('SELECT id, username, telegram_bot_token, telegram_chat_id FROM users WHERE telegram_bot_token != ? AND telegram_chat_id != ?').all('', '');
    for (const user of users) {
        const domains = db.prepare('SELECT name, expiration_date, ssl_expiry FROM domains WHERE user_id = ?').all(user.id);
        if (domains.length === 0)
            continue;
        const message = (0, telegram_1.formatDomainReport)(domains);
        (0, telegram_1.sendTelegramMessage)(user.telegram_bot_token, user.telegram_chat_id, message);
    }
});
// Start server
app.listen(PORT, () => {
    console.log(`DomainKeeper server running on http://localhost:${PORT}`);
    // Init DB and inject into dns service
    (0, db_1.getDb)();
    (0, dns_1.setDbGetter)(() => {
        try {
            return (0, db_1.getDb)();
        }
        catch {
            return null;
        }
    });
});
exports.default = app;
//# sourceMappingURL=index.js.map
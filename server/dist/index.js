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
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const node_cron_1 = __importDefault(require("node-cron"));
const db_1 = require("./db");
const auth_1 = __importDefault(require("./routes/auth"));
const domains_1 = __importStar(require("./routes/domains"));
const groups_1 = __importDefault(require("./routes/groups"));
const settings_1 = __importDefault(require("./routes/settings"));
const companies_1 = __importDefault(require("./routes/companies"));
const dashboard_1 = __importDefault(require("./routes/dashboard"));
const dns_providers_1 = __importDefault(require("./routes/dns-providers"));
const admin_1 = __importDefault(require("./routes/admin"));
const telegram_1 = require("./services/telegram");
const crypto_1 = require("./utils/crypto");
const reminder_1 = require("./services/reminder");
const dns_1 = require("./services/dns");
const app = (0, express_1.default)();
const PORT = 3001;
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// 登录限流：15分钟内最多10次
const loginLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { error: '登录尝试过多，请15分钟后再试' },
    standardHeaders: true,
    legacyHeaders: false,
});
app.use('/api/auth/login', loginLimiter);
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
// SSE endpoint — must register before auth middleware
app.get('/api/domains/refresh-all-stream', domains_1.refreshAllStreamHandler);
app.use('/api/domains', domains_1.default);
app.use('/api/groups', groups_1.default);
app.use('/api/settings', settings_1.default);
app.use('/api/companies', companies_1.default);
app.use('/api/dashboard', dashboard_1.default);
app.use('/api/dns-providers', dns_providers_1.default);
app.use('/api/admin', admin_1.default);
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
        (0, telegram_1.sendTelegramMessage)((0, crypto_1.decrypt)(user.telegram_bot_token), user.telegram_chat_id, message);
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
import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import { getDb } from './db';
import authRoutes from './routes/auth';
import domainRoutes from './routes/domains';
import groupRoutes from './routes/groups';
import settingsRoutes from './routes/settings';
import companiesRoutes from './routes/companies';
import dashboardRoutes from './routes/dashboard';
import dnsProvidersRoutes from './routes/dns-providers';
import { sendTelegramMessage, formatDomainReport } from './services/telegram';
import { checkExpirationReminders } from './services/reminder';
import { setDbGetter } from './services/dns';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// Request logger
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  if (req.method === 'POST' && req.path.includes('batch')) {
    console.log('  body:', JSON.stringify(req.body).slice(0, 300));
  }
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/domains', domainRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/companies', companiesRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/dns-providers', dnsProvidersRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// 域名到期提醒 — 每天 9:00 北京时间（UTC+8）= 01:00 UTC
cron.schedule('0 1 * * *', () => {
  checkExpirationReminders();
});

// Daily report at 12:00 Beijing time (UTC+8) = 04:00 UTC
cron.schedule('0 4 * * *', () => {
  const db = getDb();
  const users = db.prepare('SELECT id, username, telegram_bot_token, telegram_chat_id FROM users WHERE telegram_bot_token != ? AND telegram_chat_id != ?').all('', '') as any[];

  for (const user of users) {
    const domains = db.prepare('SELECT name, expiration_date, ssl_expiry FROM domains WHERE user_id = ?').all(user.id) as any[];
    if (domains.length === 0) continue;

    const message = formatDomainReport(domains);
    sendTelegramMessage(user.telegram_bot_token, user.telegram_chat_id, message);
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`DomainKeeper server running on http://localhost:${PORT}`);
  // Init DB and inject into dns service
  getDb();
  setDbGetter(() => {
    try { return getDb(); } catch { return null; }
  });
});

export default app;

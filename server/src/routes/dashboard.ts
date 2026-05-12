import { Router, Response } from 'express';
import { getDb } from '../db';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { getCompanyFilter } from '../middleware/permission';

const router = Router();
router.use(authMiddleware);

router.get('/stats', (req: AuthRequest, res: Response) => {
  const db = getDb();
  const filter = getCompanyFilter(req);
  const userId = req.user!.id;

  let total: number;
  let expired: number;
  let expiringSoon: number;
  let sslExpired: number;
  let noSsl: number;
  const today = new Date().toISOString().split('T')[0];

  if (filter.companyId === null && !filter.needsJoin) {
    // super_admin — all domains
    total = (db.prepare('SELECT COUNT(*) as count FROM domains').get() as any).count;
    expired = (db.prepare(
      "SELECT COUNT(*) as count FROM domains WHERE expiration_date != '' AND expiration_date < ?"
    ).get(today) as any).count;
    expiringSoon = (db.prepare(
      "SELECT COUNT(*) as count FROM domains WHERE expiration_date != '' AND expiration_date >= ? AND expiration_date <= date('now', '+30 days')"
    ).get(today) as any).count;
    sslExpired = (db.prepare(
      "SELECT COUNT(*) as count FROM domains WHERE ssl_expiry != '' AND ssl_expiry < ?"
    ).get(today) as any).count;
    noSsl = (db.prepare(
      "SELECT COUNT(*) as count FROM domains WHERE ssl_expiry = '' OR ssl_expiry IS NULL"
    ).get() as any).count;
  } else if (filter.companyId !== null && filter.needsJoin) {
    // company_admin / user — filter by company
    total = (db.prepare(
      'SELECT COUNT(*) as count FROM domains d LEFT JOIN users u ON d.user_id = u.id WHERE u.company_id = ?'
    ).get(filter.companyId) as any).count;
    expired = (db.prepare(
      "SELECT COUNT(*) as count FROM domains d LEFT JOIN users u ON d.user_id = u.id WHERE u.company_id = ? AND d.expiration_date != '' AND d.expiration_date < ?"
    ).get(filter.companyId, today) as any).count;
    expiringSoon = (db.prepare(
      "SELECT COUNT(*) as count FROM domains d LEFT JOIN users u ON d.user_id = u.id WHERE u.company_id = ? AND d.expiration_date != '' AND d.expiration_date >= ? AND d.expiration_date <= date('now', '+30 days')"
    ).get(filter.companyId, today) as any).count;
    sslExpired = (db.prepare(
      "SELECT COUNT(*) as count FROM domains d LEFT JOIN users u ON d.user_id = u.id WHERE u.company_id = ? AND d.ssl_expiry != '' AND d.ssl_expiry < ?"
    ).get(filter.companyId, today) as any).count;
    noSsl = (db.prepare(
      "SELECT COUNT(*) as count FROM domains d LEFT JOIN users u ON d.user_id = u.id WHERE u.company_id = ? AND (d.ssl_expiry = '' OR d.ssl_expiry IS NULL)"
    ).get(filter.companyId) as any).count;
  } else {
    // fallback: just user's own domains
    total = (db.prepare('SELECT COUNT(*) as count FROM domains WHERE user_id = ?').get(userId) as any).count;
    expired = (db.prepare(
      "SELECT COUNT(*) as count FROM domains WHERE user_id = ? AND expiration_date != '' AND expiration_date < ?"
    ).get(userId, today) as any).count;
    expiringSoon = (db.prepare(
      "SELECT COUNT(*) as count FROM domains WHERE user_id = ? AND expiration_date != '' AND expiration_date >= ? AND expiration_date <= date('now', '+30 days')"
    ).get(userId, today) as any).count;
    sslExpired = (db.prepare(
      "SELECT COUNT(*) as count FROM domains WHERE user_id = ? AND ssl_expiry != '' AND ssl_expiry < ?"
    ).get(userId, today) as any).count;
    noSsl = (db.prepare(
      "SELECT COUNT(*) as count FROM domains WHERE user_id = ? AND (ssl_expiry = '' OR ssl_expiry IS NULL)"
    ).get(userId) as any).count;
  }

  res.json({
    stats: {
      total,
      expired,
      expiring_soon: expiringSoon,
      ssl_expired: sslExpired,
      no_ssl: noSsl,
    },
  });
});

export default router;

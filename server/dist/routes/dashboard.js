"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../db");
const auth_1 = require("../middleware/auth");
const permission_1 = require("../middleware/permission");
const router = (0, express_1.Router)();
router.use(auth_1.authMiddleware);
router.get('/stats', (req, res) => {
    const db = (0, db_1.getDb)();
    const filter = (0, permission_1.getCompanyFilter)(req);
    const userId = req.user.id;
    let total;
    let expired;
    let expiringSoon;
    let sslExpired;
    let noSsl;
    const today = new Date().toISOString().split('T')[0];
    if (filter.companyId === null && !filter.needsJoin) {
        // super_admin — all domains
        total = db.prepare('SELECT COUNT(*) as count FROM domains').get().count;
        expired = db.prepare("SELECT COUNT(*) as count FROM domains WHERE expiration_date != '' AND expiration_date < ?").get(today).count;
        expiringSoon = db.prepare("SELECT COUNT(*) as count FROM domains WHERE expiration_date != '' AND expiration_date >= ? AND expiration_date <= date('now', '+30 days')").get(today).count;
        sslExpired = db.prepare("SELECT COUNT(*) as count FROM domains WHERE ssl_expiry != '' AND ssl_expiry < ?").get(today).count;
        noSsl = db.prepare("SELECT COUNT(*) as count FROM domains WHERE ssl_expiry = '' OR ssl_expiry IS NULL").get().count;
    }
    else if (filter.companyId !== null && filter.needsJoin) {
        // company_admin / user — filter by company
        total = db.prepare('SELECT COUNT(*) as count FROM domains d LEFT JOIN users u ON d.user_id = u.id WHERE u.company_id = ?').get(filter.companyId).count;
        expired = db.prepare("SELECT COUNT(*) as count FROM domains d LEFT JOIN users u ON d.user_id = u.id WHERE u.company_id = ? AND d.expiration_date != '' AND d.expiration_date < ?").get(filter.companyId, today).count;
        expiringSoon = db.prepare("SELECT COUNT(*) as count FROM domains d LEFT JOIN users u ON d.user_id = u.id WHERE u.company_id = ? AND d.expiration_date != '' AND d.expiration_date >= ? AND d.expiration_date <= date('now', '+30 days')").get(filter.companyId, today).count;
        sslExpired = db.prepare("SELECT COUNT(*) as count FROM domains d LEFT JOIN users u ON d.user_id = u.id WHERE u.company_id = ? AND d.ssl_expiry != '' AND d.ssl_expiry < ?").get(filter.companyId, today).count;
        noSsl = db.prepare("SELECT COUNT(*) as count FROM domains d LEFT JOIN users u ON d.user_id = u.id WHERE u.company_id = ? AND (d.ssl_expiry = '' OR d.ssl_expiry IS NULL)").get(filter.companyId).count;
    }
    else {
        // fallback: just user's own domains
        total = db.prepare('SELECT COUNT(*) as count FROM domains WHERE user_id = ?').get(userId).count;
        expired = db.prepare("SELECT COUNT(*) as count FROM domains WHERE user_id = ? AND expiration_date != '' AND expiration_date < ?").get(userId, today).count;
        expiringSoon = db.prepare("SELECT COUNT(*) as count FROM domains WHERE user_id = ? AND expiration_date != '' AND expiration_date >= ? AND expiration_date <= date('now', '+30 days')").get(userId, today).count;
        sslExpired = db.prepare("SELECT COUNT(*) as count FROM domains WHERE user_id = ? AND ssl_expiry != '' AND ssl_expiry < ?").get(userId, today).count;
        noSsl = db.prepare("SELECT COUNT(*) as count FROM domains WHERE user_id = ? AND (ssl_expiry = '' OR ssl_expiry IS NULL)").get(userId).count;
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
exports.default = router;
//# sourceMappingURL=dashboard.js.map
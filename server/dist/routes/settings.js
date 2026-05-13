"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../db");
const auth_1 = require("../middleware/auth");
const permission_1 = require("../middleware/permission");
const telegram_1 = require("../services/telegram");
const router = (0, express_1.Router)();
router.use(auth_1.authMiddleware);
// Get Telegram settings
router.get('/telegram', (req, res) => {
    const db = (0, db_1.getDb)();
    const user = db.prepare('SELECT telegram_bot_token, telegram_chat_id FROM users WHERE id = ?').get(req.user.id);
    res.json({
        telegram_bot_token: user.telegram_bot_token || '',
        telegram_chat_id: user.telegram_chat_id || '',
    });
});
// Update Telegram settings
router.put('/telegram', (0, permission_1.requirePermission)('setting:telegram'), (req, res) => {
    const { telegram_bot_token, telegram_chat_id } = req.body;
    const db = (0, db_1.getDb)();
    db.prepare('UPDATE users SET telegram_bot_token = ?, telegram_chat_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(telegram_bot_token || '', telegram_chat_id || '', req.user.id);
    (0, db_1.logOperation)(req.user.id, req.user.username, 'update', 'user', req.user.id, req.user.username, '修改 Telegram 通知设置');
    res.json({ message: '设置已保存' });
});
// Test Telegram
router.post('/telegram/test', (0, permission_1.requirePermission)('setting:telegram'), async (req, res) => {
    const db = (0, db_1.getDb)();
    const user = db.prepare('SELECT telegram_bot_token, telegram_chat_id FROM users WHERE id = ?').get(req.user.id);
    if (!user.telegram_bot_token || !user.telegram_chat_id) {
        res.status(400).json({ error: '请先配置 Bot Token 和 Chat ID' });
        return;
    }
    const ok = await (0, telegram_1.sendTelegramMessage)(user.telegram_bot_token, user.telegram_chat_id, '<b>✅ DomainKeeper 通知测试</b>\n\n如果收到这条消息，说明配置正确！');
    if (ok) {
        res.json({ message: '测试消息已发送' });
    }
    else {
        res.status(500).json({ error: '发送失败，请检查配置' });
    }
});
exports.default = router;
//# sourceMappingURL=settings.js.map
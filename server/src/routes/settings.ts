import { Router, Response } from 'express';
import { getDb, logOperation } from '../db';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { requirePermission } from '../middleware/permission';
import { sendTelegramMessage } from '../services/telegram';

const router = Router();
router.use(authMiddleware);

// Get Telegram settings
router.get('/telegram', (req: AuthRequest, res: Response) => {
  const db = getDb();
  const user = db.prepare('SELECT telegram_bot_token, telegram_chat_id FROM users WHERE id = ?').get(req.user!.id) as any;
  res.json({
    telegram_bot_token: user.telegram_bot_token || '',
    telegram_chat_id: user.telegram_chat_id || '',
  });
});

// Update Telegram settings
router.put('/telegram', requirePermission('setting:telegram'), (req: AuthRequest, res: Response) => {
  const { telegram_bot_token, telegram_chat_id } = req.body;
  const db = getDb();
  db.prepare('UPDATE users SET telegram_bot_token = ?, telegram_chat_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(telegram_bot_token || '', telegram_chat_id || '', req.user!.id);
  logOperation(req.user!.id, req.user!.username, 'update', 'user', req.user!.id, req.user!.username, '修改 Telegram 通知设置');
  res.json({ message: '设置已保存' });
});

// Test Telegram
router.post('/telegram/test', requirePermission('setting:telegram'), async (req: AuthRequest, res: Response) => {
  const db = getDb();
  const user = db.prepare('SELECT telegram_bot_token, telegram_chat_id FROM users WHERE id = ?').get(req.user!.id) as any;

  if (!user.telegram_bot_token || !user.telegram_chat_id) {
    res.status(400).json({ error: '请先配置 Bot Token 和 Chat ID' });
    return;
  }

  const ok = await sendTelegramMessage(user.telegram_bot_token, user.telegram_chat_id, '<b>✅ DomainKeeper 通知测试</b>\n\n如果收到这条消息，说明配置正确！');
  if (ok) {
    res.json({ message: '测试消息已发送' });
  } else {
    res.status(500).json({ error: '发送失败，请检查配置' });
  }
});

export default router;

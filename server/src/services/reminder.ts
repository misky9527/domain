import { getDb } from '../db';
import { sendTelegramMessage } from './telegram';
import { decrypt } from '../utils/crypto';
import { Router, Response } from 'express';
import { AuthRequest } from '../middleware/auth';

const THRESHOLDS = [30, 15, 7, 3, 1];

/**
 * 手动触发到期检测，发送 Telegram 通知
 */
export function manualExpiryCheck(userId: number): { count: number; message: string } {
  const db = getDb();

  const user = db.prepare(
    "SELECT id, username, telegram_bot_token, telegram_chat_id FROM users WHERE id = ? AND telegram_bot_token != '' AND telegram_chat_id != ''"
  ).get(userId) as any;

  if (!user) {
    return { count: 0, message: '未配置 Telegram，请先在设置页配置 Bot Token 和 Chat ID' };
  }

  const domains = db.prepare(
    "SELECT id, name, expiration_date FROM domains WHERE user_id = ? AND expiration_date != ''"
  ).all(userId) as any[];

  if (domains.length === 0) {
    return { count: 0, message: '没有待检测的域名' };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const reminders: Array<{ name: string; days: number }> = [];

  for (const domain of domains) {
    const expiryDate = new Date(domain.expiration_date);
    expiryDate.setHours(0, 0, 0, 0);
    const diffMs = expiryDate.getTime() - today.getTime();
    const daysRemaining = Math.round(diffMs / (1000 * 60 * 60 * 24));

    // 报告所有 30天内到期 + 已过期的
    if (daysRemaining < 0 || daysRemaining <= 30) {
      reminders.push({ name: domain.name, days: daysRemaining });

      // 记录到 reminder_log（避免 cron 再重复发），用最接近的阈值
      if (daysRemaining >= 0) {
        for (const threshold of THRESHOLDS) {
          if (daysRemaining <= threshold) {
            const alreadySent = db.prepare(
              'SELECT id FROM reminder_log WHERE domain_id = ? AND threshold = ?'
            ).get(domain.id, threshold);
            if (!alreadySent) {
              db.prepare(
                'INSERT INTO reminder_log (domain_id, user_id, threshold) VALUES (?, ?, ?)'
              ).run(domain.id, userId, threshold);
            }
            break;
          }
        }
      }
    }
  }

  if (reminders.length === 0) {
    return { count: 0, message: '所有域名状态正常，无需提醒' };
  }

  let msg = '<b>🔍 手动检测 — 域名到期提醒</b>\n\n';
  const expired = reminders.filter(r => r.days < 0);
  const normal = reminders.filter(r => r.days >= 0);

  if (expired.length > 0) {
    msg += '❌ 已过期：\n';
    for (const r of expired) {
      msg += `  ${r.name} — 已过期 ${Math.abs(r.days)} 天\n`;
    }
    msg += '\n';
  }

  if (normal.length > 0) {
    msg += '⏰ 即将到期：\n';
    for (const r of normal) {
      msg += `  ${r.name} — 还剩 <b>${r.days}</b> 天\n`;
    }
  }

  const decryptedToken = decrypt(user.telegram_bot_token);
  sendTelegramMessage(decryptedToken, user.telegram_chat_id, msg);
  return { count: reminders.length, message: `已发送 ${reminders.length} 条提醒到 Telegram` };
}

/**
 * 检查所有域名的到期时间，发送到期提醒
 * 每天由 cron 触发一次
 */
export function checkExpirationReminders(): void {
  const db = getDb();

  // 找所有配了 Telegram 的用户
  const users = db.prepare(
    "SELECT id, username, telegram_bot_token, telegram_chat_id FROM users WHERE telegram_bot_token != '' AND telegram_chat_id != ''"
  ).all() as any[];

  for (const user of users) {
    const domains = db.prepare(
      "SELECT id, name, expiration_date FROM domains WHERE user_id = ? AND expiration_date != ''"
    ).all(user.id) as any[];

    if (domains.length === 0) continue;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const remindersToSend: Array<{ name: string; days: number }> = [];

    for (const domain of domains) {
      const expiryDate = new Date(domain.expiration_date);
      expiryDate.setHours(0, 0, 0, 0);
      const diffMs = expiryDate.getTime() - today.getTime();
      const daysRemaining = Math.round(diffMs / (1000 * 60 * 60 * 24));

      for (const threshold of THRESHOLDS) {
        if (daysRemaining !== threshold) continue;

        // 检查是否已经发过这个阈值的提醒
        const alreadySent = db.prepare(
          'SELECT id FROM reminder_log WHERE domain_id = ? AND threshold = ?'
        ).get(domain.id, threshold);

        if (alreadySent) continue;

        remindersToSend.push({ name: domain.name, days: daysRemaining });
        // 记录已发送
        db.prepare(
          'INSERT INTO reminder_log (domain_id, user_id, threshold) VALUES (?, ?, ?)'
        ).run(domain.id, user.id, threshold);
        break; // 一个域名一次只发一条
      }
    }

    if (remindersToSend.length === 0) continue;

    // 组一条消息，多个域名拼一起
    let msg = '<b>⏰ 域名到期提醒</b>\n\n';
    for (const r of remindersToSend) {
      msg += `  ${r.name} — 还剩 <b>${r.days}</b> 天\n`;
    }

    const decryptedToken = decrypt(user.telegram_bot_token);
    sendTelegramMessage(decryptedToken, user.telegram_chat_id, msg);
  }
}

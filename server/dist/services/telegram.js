"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendTelegramMessage = sendTelegramMessage;
exports.formatDomainReport = formatDomainReport;
const node_fetch_1 = __importDefault(require("node-fetch"));
async function sendTelegramMessage(botToken, chatId, message) {
    if (!botToken || !chatId)
        return false;
    try {
        const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
        const res = await (0, node_fetch_1.default)(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: message,
                parse_mode: 'HTML',
            }),
            timeout: 10000,
        });
        return res.ok;
    }
    catch (err) {
        console.error('Telegram send failed:', err);
        return false;
    }
}
function formatDomainReport(domains) {
    let msg = '<b>📋 域名日报</b>\n\n';
    const expiringSoon = domains.filter(d => {
        if (!d.expiration_date)
            return false;
        const days = daysUntil(d.expiration_date);
        return days >= 0 && days <= 30;
    });
    const expired = domains.filter(d => {
        if (!d.expiration_date)
            return false;
        return daysUntil(d.expiration_date) < 0;
    });
    if (expired.length > 0) {
        msg += `❌ <b>已过期 (${expired.length})</b>\n`;
        expired.forEach(d => {
            msg += `  ${d.name} — 已过期 ${Math.abs(daysUntil(d.expiration_date))} 天\n`;
        });
        msg += '\n';
    }
    if (expiringSoon.length > 0) {
        msg += `⚠️ <b>即将到期 (${expiringSoon.length})</b>\n`;
        expiringSoon.forEach(d => {
            msg += `  ${d.name} — ${daysUntil(d.expiration_date)} 天后到期\n`;
        });
        msg += '\n';
    }
    msg += `📊 总计 ${domains.length} 个域名`;
    return msg;
}
function daysUntil(dateStr) {
    const d = new Date(dateStr);
    const now = new Date();
    return Math.floor((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}
//# sourceMappingURL=telegram.js.map
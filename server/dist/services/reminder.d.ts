/**
 * 手动触发到期检测，发送 Telegram 通知
 */
export declare function manualExpiryCheck(userId: number): {
    count: number;
    message: string;
};
/**
 * 检查所有域名的到期时间，发送到期提醒
 * 每天由 cron 触发一次
 */
export declare function checkExpirationReminders(): void;
//# sourceMappingURL=reminder.d.ts.map
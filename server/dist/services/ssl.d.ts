interface SslInfo {
    expiry: string;
    issuer: string;
    valid: boolean;
    days_remaining: number;
}
export declare function checkSsl(hostname: string): Promise<SslInfo>;
export declare function checkSslHttp(hostname: string): Promise<SslInfo>;
export {};
//# sourceMappingURL=ssl.d.ts.map
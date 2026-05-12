"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkSsl = checkSsl;
exports.checkSslHttp = checkSslHttp;
const tls_1 = __importDefault(require("tls"));
const node_fetch_1 = __importDefault(require("node-fetch"));
function getIssuer(cert) {
    const org = Array.isArray(cert.issuer?.O) ? cert.issuer.O[0] : (cert.issuer?.O || '');
    const cn = Array.isArray(cert.issuer?.CN) ? cert.issuer.CN[0] : (cert.issuer?.CN || '');
    return org || cn || '';
}
function checkSsl(hostname) {
    return new Promise((resolve) => {
        const socket = tls_1.default.connect(443, hostname, { servername: hostname }, () => {
            const cert = socket.getPeerCertificate();
            const expiry = new Date(cert.valid_to);
            const now = new Date();
            const daysRemaining = Math.floor((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            resolve({
                expiry: cert.valid_to,
                issuer: getIssuer(cert),
                valid: daysRemaining > 0,
                days_remaining: daysRemaining,
            });
            socket.end();
        });
        socket.on('error', () => {
            resolve({
                expiry: '',
                issuer: '',
                valid: false,
                days_remaining: 0,
            });
        });
        socket.setTimeout(8000, () => {
            socket.destroy();
            resolve({
                expiry: '',
                issuer: '',
                valid: false,
                days_remaining: 0,
            });
        });
    });
}
async function checkSslHttp(hostname) {
    try {
        const url = `https://${hostname}`;
        const res = await (0, node_fetch_1.default)(url, { timeout: 10000, method: 'HEAD' });
        const socket = res.socket;
        if (socket && socket.getPeerCertificate) {
            const cert = socket.getPeerCertificate();
            if (cert && cert.valid_to) {
                const expiry = new Date(cert.valid_to);
                const now = new Date();
                const daysRemaining = Math.floor((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                return {
                    expiry: cert.valid_to,
                    issuer: getIssuer(cert),
                    valid: daysRemaining > 0,
                    days_remaining: daysRemaining,
                };
            }
        }
        return { expiry: '', issuer: '', valid: false, days_remaining: 0 };
    }
    catch {
        return checkSsl(hostname);
    }
}
//# sourceMappingURL=ssl.js.map
import tls from 'tls';
import fetch from 'node-fetch';
import { PeerCertificate } from 'tls';

interface SslInfo {
  expiry: string;
  issuer: string;
  valid: boolean;
  days_remaining: number;
}

function getIssuer(cert: PeerCertificate): string {
  const org = Array.isArray(cert.issuer?.O) ? cert.issuer.O[0] : (cert.issuer?.O || '');
  const cn = Array.isArray(cert.issuer?.CN) ? cert.issuer.CN[0] : (cert.issuer?.CN || '');
  return org || cn || '';
}

export function checkSsl(hostname: string): Promise<SslInfo> {
  return new Promise((resolve) => {
    const socket = tls.connect(443, hostname, { servername: hostname }, () => {
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

export async function checkSslHttp(hostname: string): Promise<SslInfo> {
  try {
    const url = `https://${hostname}`;
    const res = await fetch(url, { timeout: 10000, method: 'HEAD' });
    const socket = (res as any).socket;
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
  } catch {
    return checkSsl(hostname);
  }
}

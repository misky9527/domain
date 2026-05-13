import fs from 'fs';
import path from 'path';
import { getDb } from '../db';

const BACKUP_DIR = path.join(__dirname, '..', '..', 'data', 'backups');
const MAX_BACKUPS = 30; // 保留最近30天
const RETENTION_DAYS = 30;

function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

export function createBackup(): { filename: string; size: number; created_at: string } {
  ensureBackupDir();
  const now = new Date();
  const ts = now.toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
  const filename = `domain-keeper_${ts}.db`;
  const backupPath = path.join(BACKUP_DIR, filename);

  // 创建备份目录
  const db = getDb();
  // 使用 VACUUM INTO 创建独立备份文件（更安全，不影响在线数据库）
  db.exec(`VACUUM INTO '${backupPath.replace(/'/g, "''")}'`);

  const stat = fs.statSync(backupPath);
  
  // 清理过期备份
  cleanupOldBackups();

  return {
    filename,
    size: stat.size,
    created_at: now.toISOString(),
  };
}

export function listBackups(): Array<{ filename: string; size: number; created_at: string }> {
  ensureBackupDir();
  const files = fs.readdirSync(BACKUP_DIR)
    .filter(f => f.endsWith('.db'))
    .sort()
    .reverse()
    .map(f => {
      const stat = fs.statSync(path.join(BACKUP_DIR, f));
      return {
        filename: f,
        size: stat.size,
        created_at: stat.mtime.toISOString(),
      };
    });
  return files;
}

export function deleteBackup(filename: string): boolean {
  const backupPath = path.join(BACKUP_DIR, filename);
  // 安全检查：只允许删除 backups 目录下的 .db 文件
  if (!filename.endsWith('.db') || filename.includes('..') || filename.includes('/')) {
    return false;
  }
  if (!fs.existsSync(backupPath)) {
    return false;
  }
  fs.unlinkSync(backupPath);
  return true;
}

export function getBackupPath(filename: string): string | null {
  const backupPath = path.join(BACKUP_DIR, filename);
  if (!filename.endsWith('.db') || filename.includes('..') || filename.includes('/')) {
    return null;
  }
  if (!fs.existsSync(backupPath)) {
    return null;
  }
  return backupPath;
}

function cleanupOldBackups() {
  const files = fs.readdirSync(BACKUP_DIR)
    .filter(f => f.endsWith('.db'))
    .sort()
    .reverse();

  // 删除超过 MAX_BACKUPS 的旧备份
  if (files.length > MAX_BACKUPS) {
    files.slice(MAX_BACKUPS).forEach(f => {
      fs.unlinkSync(path.join(BACKUP_DIR, f));
    });
  }
}

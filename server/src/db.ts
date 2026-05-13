import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(__dirname, '..', 'data', 'domain-keeper.db');

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    const fs = require('fs');
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema();
  }
  return db;
}

function addColumnIfNotExists(table: string, column: string, def: string) {
  // SQLite doesn't support IF NOT EXISTS for ALTER TABLE, so we try/catch
  try {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${def}`);
  } catch (e: any) {
    // Column already exists — ignore
    if (!e.message?.includes('duplicate column')) throw e;
  }
}

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      company_id INTEGER DEFAULT NULL REFERENCES companies(id) ON DELETE SET NULL,
      permissions TEXT DEFAULT '',
      telegram_bot_token TEXT DEFAULT '',
      telegram_chat_id TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS companies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS domain_groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS domains (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      group_id INTEGER,
      name TEXT NOT NULL,
      registrar TEXT DEFAULT '',
      registration_date TEXT DEFAULT '',
      expiration_date TEXT DEFAULT '',
      purpose TEXT DEFAULT '',
      tags TEXT DEFAULT '',
      ssl_expiry TEXT DEFAULT '',
      ssl_issuer TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (group_id) REFERENCES domain_groups(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS reminder_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      domain_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      threshold INTEGER NOT NULL,
      sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (domain_id) REFERENCES domains(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_reminder_log_lookup ON reminder_log(domain_id, threshold);

    CREATE TABLE IF NOT EXISTS dns_providers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      domain TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Add columns for users table if upgrading from old schema
  // (companies table was already created above if it didn't exist)
  addColumnIfNotExists('users', 'company_id', 'INTEGER DEFAULT NULL REFERENCES companies(id) ON DELETE SET NULL');
  addColumnIfNotExists('users', 'permissions', 'TEXT DEFAULT \'\'');
  addColumnIfNotExists('users', 'status', 'TEXT DEFAULT \'approved\'');
  addColumnIfNotExists('domains', 'dns_records', 'TEXT DEFAULT \'\'');
  addColumnIfNotExists('domains', 'dns_ns_server', 'TEXT DEFAULT \'\'');
  addColumnIfNotExists('domains', 'dns_ns_provider', 'TEXT DEFAULT \'\'');
  addColumnIfNotExists('domain_groups', 'is_default', 'INTEGER DEFAULT 0');

  // Migrate existing admin role → super_admin
  db.prepare("UPDATE users SET role = 'super_admin' WHERE role = 'admin'").run();

  // Backfill dns_ns_server/dns_ns_provider for domains with dns_records but no NS info
  db.prepare(
    "UPDATE domains SET dns_ns_server = '' WHERE dns_ns_server IS NULL"
  ).run();
  db.prepare(
    "UPDATE domains SET dns_ns_provider = '' WHERE dns_ns_provider IS NULL"
  ).run();
}

/**
 * Get or create the default group for a user.
 */
export function getOrCreateDefaultGroup(userId: number): number {
  const db = getDb();
  const existing = db.prepare('SELECT id FROM domain_groups WHERE user_id = ? AND is_default = 1').get(userId) as any;
  if (existing) return existing.id;
  const result = db.prepare('INSERT INTO domain_groups (user_id, name, is_default) VALUES (?, ?, 1)').run(userId, '默认组');
  return result.lastInsertRowid as number;
}

/**
 * Get or create a group by name for a user.
 */
export function getOrCreateGroup(userId: number, name: string): number {
  const db = getDb();
  const existing = db.prepare('SELECT id FROM domain_groups WHERE user_id = ? AND name = ?').get(userId, name) as any;
  if (existing) return existing.id;
  const result = db.prepare('INSERT INTO domain_groups (user_id, name) VALUES (?, ?)').run(userId, name);
  return result.lastInsertRowid as number;
}

export default getDb;

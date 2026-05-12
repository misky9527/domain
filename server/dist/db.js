"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDb = getDb;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const path_1 = __importDefault(require("path"));
const DB_PATH = path_1.default.join(__dirname, '..', 'data', 'domain-keeper.db');
let db;
function getDb() {
    if (!db) {
        const fs = require('fs');
        const dir = path_1.default.dirname(DB_PATH);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        db = new better_sqlite3_1.default(DB_PATH);
        db.pragma('journal_mode = WAL');
        db.pragma('foreign_keys = ON');
        initSchema();
    }
    return db;
}
function addColumnIfNotExists(table, column, def) {
    // SQLite doesn't support IF NOT EXISTS for ALTER TABLE, so we try/catch
    try {
        db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${def}`);
    }
    catch (e) {
        // Column already exists — ignore
        if (!e.message?.includes('duplicate column'))
            throw e;
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
  `);
    // Add columns for users table if upgrading from old schema
    // (companies table was already created above if it didn't exist)
    addColumnIfNotExists('users', 'company_id', 'INTEGER DEFAULT NULL REFERENCES companies(id) ON DELETE SET NULL');
    addColumnIfNotExists('users', 'permissions', 'TEXT DEFAULT \'\'');
    addColumnIfNotExists('users', 'status', 'TEXT DEFAULT \'approved\'');
    addColumnIfNotExists('domains', 'dns_records', 'TEXT DEFAULT \'\'');
    // Migrate existing admin role → super_admin
    db.prepare("UPDATE users SET role = 'super_admin' WHERE role = 'admin'").run();
}
exports.default = getDb;
//# sourceMappingURL=db.js.map
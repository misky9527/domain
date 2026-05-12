# DomainKeeper v2 — 设计文档

## 数据库 Schema

### `users`
```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',  -- 'user' | 'admin'
  telegram_bot_token TEXT DEFAULT '',
  telegram_chat_id TEXT DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### `domain_groups`
```sql
CREATE TABLE domain_groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### `domains`
```sql
CREATE TABLE domains (
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
  FOREIGN KEY (group_id) REFERENCES domain_groups(id)
);
```

## API 端点

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /api/auth/register | No | 注册 |
| POST | /api/auth/login | No | 登录 |
| GET | /api/auth/me | JWT | 当前用户信息 |
| GET | /api/domains | JWT | 域名列表（分页/搜索/筛选） |
| POST | /api/domains | JWT | 添加域名 |
| GET | /api/domains/:id | JWT | 域名详情 |
| PUT | /api/domains/:id | JWT | 更新域名 |
| DELETE | /api/domains/:id | JWT | 删除域名 |
| POST | /api/domains/whois | JWT | 查询 Whois 信息（不保存） |
| POST | /api/domains/batch-whois | JWT | 批量查询 Whois |
| POST | /api/domains/batch | JWT | 批量保存域名 |
| PUT | /api/domains/:id/refresh-dns | JWT | 刷新 DNS |
| PUT | /api/domains/:id/refresh-ssl | JWT | 刷新 SSL |
| GET | /api/domains/:id/dns | JWT | DNS 记录 |
| GET | /api/domains/:id/ssl | JWT | SSL 信息 |
| GET | /api/groups | JWT | 分组列表 |
| POST | /api/groups | JWT | 创建分组 |
| PUT | /api/groups/:id | JWT | 更新分组 |
| DELETE | /api/groups/:id | JWT | 删除分组 |
| GET | /api/dashboard/stats | JWT | Dashboard 统计 |
| PUT | /api/settings/telegram | JWT | 更新 Telegram 设置 |
| POST | /api/settings/telegram/test | JWT | 测试 Telegram 通知 |

## 前端路由

| Path | Component | Description |
|------|-----------|-------------|
| /login | Login | 登录 |
| /register | Register | 注册 |
| / | Dashboard | 主面板 |
| /domains/:id | DomainDetail | 域名详情 |
| /domains/add | AddDomain | 手动添加 |
| /domains/batch | BatchAdd | 批量导入 |
| /groups | Groups | 分组管理 |
| /settings | Settings | 设置 |

## 端口
- 后端：3001
- 前端 Dev：5173（Vite proxy /api → localhost:3001）

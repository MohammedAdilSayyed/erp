# Deployment Guide

This guide covers running the College ERP system in production on a Linux server (Ubuntu/Debian assumed), with nginx + systemd, optional Docker, and backup strategy.

## 1. Bare-metal (recommended for small colleges)

### 1.1 Install Node.js

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs build-essential
```

### 1.2 Create a service user

```bash
sudo useradd -r -m -d /opt/erp -s /bin/bash erp
sudo -u erp -i
```

### 1.3 Deploy code

```bash
cd /opt/erp
git clone <your-repo> .
cd backend
npm ci --omit=dev
cp .env.example .env   # or use the included .env
# EDIT .env — set JWT_SECRET to a strong random value
nano .env
npm run init-db
npm run seed           # optional — load demo data
```

### 1.4 systemd unit

Create `/etc/systemd/system/college-erp.service`:

```ini
[Unit]
Description=College ERP
After=network.target

[Service]
Type=simple
User=erp
WorkingDirectory=/opt/erp/backend
EnvironmentFile=/opt/erp/backend/.env
ExecStart=/usr/bin/node src/server.js
Restart=on-failure
RestartSec=5
StandardOutput=append:/var/log/erp/erp.log
StandardError=append:/var/log/erp/erp-error.log

[Install]
WantedBy=multi-user.target
```

```bash
sudo mkdir -p /var/log/erp && sudo chown erp:erp /var/log/erp
sudo systemctl daemon-reload
sudo systemctl enable --now college-erp
sudo systemctl status college-erp
```

### 1.5 nginx reverse proxy

`/etc/nginx/sites-available/erp.conf`:

```nginx
server {
  listen 80;
  server_name erp.college.edu;
  client_max_body_size 5M;

  # Rate-limit at edge
  limit_req_zone $binary_remote_addr zone=erp:10m rate=30r/s;

  location / {
    limit_req zone=erp burst=60 nodelay;
    proxy_pass http://127.0.0.1:4000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/erp.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### 1.6 TLS (Let's Encrypt)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d erp.college.edu
```

---

## 2. Docker

### `Dockerfile` (multi-stage)
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY backend/package*.json ./
RUN npm ci --omit=dev
COPY backend/ ./
RUN mkdir -p data
ENV NODE_ENV=production PORT=4000
EXPOSE 4000
CMD ["node", "src/server.js"]
```

### `docker-compose.yml`
```yaml
version: "3.9"
services:
  erp:
    build: .
    restart: unless-stopped
    ports: ["4000:4000"]
    volumes:
      - ./data:/app/data
    env_file: .env
```

```bash
docker compose up -d --build
docker compose exec erp node src/db/init.js
docker compose exec erp node src/db/seed.js
```

---

## 3. Backups

The entire application state lives in `backend/data/erp.db`. Use `scripts/backup.sh`:

```bash
# Daily cron — 02:00
0 2 * * * /opt/erp/scripts/backup.sh
```

The script (already in the repo) does `sqlite3 .backup` for a safe online copy, prunes backups older than 30 days, and writes to `/var/backups/erp/`.

To restore:
```bash
sudo systemctl stop college-erp
sudo cp /var/backups/erp/erp-YYYYMMDD.db /opt/erp/backend/data/erp.db
sudo systemctl start college-erp
```

---

## 4. Monitoring

- **Health endpoint**: `GET /api/health` returns 200 + JSON. Wire into Uptime Kuma / Prometheus blackbox.
- **Logs**: `/var/log/erp/erp.log` (combined) and `erp-error.log` (stderr).
- **Audit logs**: query `audit_logs` table in the SQLite DB for security review.

---

## 5. Updating

```bash
sudo -u erp -i
cd /opt/erp
git pull
cd backend
npm ci --omit=dev
sudo systemctl restart college-erp
```

The database schema uses `CREATE TABLE IF NOT EXISTS` so reloads are safe. For schema migrations, add new SQL files in `src/db/migrations/` and run them with `sqlite3 data/erp.db < migration.sql` after a backup.

---

## 6. Hardening checklist

- [ ] `JWT_SECRET` set to a 32+ char random value (not the default in `.env`)
- [ ] `NODE_ENV=production`
- [ ] `CORS_ORIGIN` set to your real domain (not `*`)
- [ ] Firewall: only 22, 80, 443 open
- [ ] SSH: key-based auth, no root login
- [ ] Backups running daily, tested restore
- [ ] Auto security updates enabled (`unattended-upgrades`)
- [ ] Logrotate for `/var/log/erp/*.log`
- [ ] Reverse proxy TLS with strong ciphers
- [ ] Fail2ban for SSH

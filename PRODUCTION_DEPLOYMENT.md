# Vinayak Academy Production Deployment

This guide deploys the existing Node/Express application on Ubuntu VPS with Nginx, PM2, Supabase, and Cloudflare R2. Do not commit `.env`, database dumps, log files, or uploaded private materials.

## Prerequisites

- Ubuntu VPS with a non-root deploy user.
- Node.js LTS installed.
- PM2 installed globally.
- Nginx installed.
- HTTPS certificate from Certbot or your VPS provider.
- Supabase project with required tables/views and RLS reviewed.
- Cloudflare R2 bucket and credentials for material storage.

## Required Environment

Create `.env` on the VPS only. Keep real values out of Git.

Required for production:

```env
NODE_ENV=production
PORT=3000
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SESSION_SECRET=
PDF_ACCESS_SECRET=
R2_ACCOUNT_ID=
R2_ACCESS_KEY=
R2_SECRET_KEY=
R2_BUCKET=
R2_ENDPOINT=
ALLOWED_ORIGINS=https://vinayakacademy.online,https://www.vinayakacademy.online
```

Optional:

```env
TRUST_PROXY=loopback
TURNSTILE_SITE_KEY=
TURNSTILE_SECRET_KEY=
OTP_SMS_ENDPOINT=
OTP_SMS_METHOD=
OTP_SMS_AUTH_HEADER=
OTP_SMS_AUTH_VALUE=
PUBLIC_ADMISSION_FEE_DEFAULT=
PUBLIC_MAX_EMI_COUNT=
ADMIN_SESSION_TTL_SECONDS=
```

Production startup fails if required security secrets or service-role Supabase access are missing.

## Install

```bash
git pull
npm ci --omit=dev
node --check server.js
NODE_ENV=production node server.js
```

Stop the manual process after validation, then use PM2.

## PM2

```bash
pm2 start ecosystem.config.cjs
pm2 status
pm2 logs vinayak-academy
pm2 save
pm2 startup
```

The app uses PM2 fork mode because current session compatibility depends on one Node process.

## Nginx

Replace `vinayakacademy.online` with the live domain if different.

```nginx
server {
    listen 80;
    server_name vinayakacademy.online www.vinayakacademy.online;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name vinayakacademy.online www.vinayakacademy.online;

    ssl_certificate /etc/letsencrypt/live/vinayakacademy.online/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/vinayakacademy.online/privkey.pem;

    client_max_body_size 220M;

    location ~* ^/(admin|dashboard|studymaterial|profile|assignments|attendance|emi|pdf-viewer|login)\.html$ {
        add_header Cache-Control "no-store";
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api/ {
        add_header Cache-Control "no-store";
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location ~* \.(?:css|js|png|jpg|jpeg|webp|gif|svg|ico|woff|woff2)$ {
        expires 7d;
        add_header Cache-Control "public, max-age=604800, immutable";
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Validate:

```bash
sudo nginx -t
sudo systemctl reload nginx
curl -fsS https://vinayakacademy.online/health
```

## Backups

Before deployment:

- Archive the current VPS application directory outside the public web root.
- Back up `.env` to a secure private location.
- Export/backup Supabase data.
- Verify Cloudflare R2 material backup/retention.

Do not store backups inside the served app directory.

## Rollback

1. Identify the previous working Git commit/tag.
2. Restore the previous app directory or run `git checkout <commit>`.
3. Run `npm ci --omit=dev` if dependencies changed.
4. Restore the previous `.env` if needed.
5. Run `pm2 restart vinayak-academy`.
6. Run `/health` and the smoke checklist.

Do not drop or truncate production tables during rollback. Uploaded files created during a failed deployment should be reviewed before deletion.

## Logs

```bash
pm2 logs vinayak-academy
pm2 monit
```

Recommended:

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 20M
pm2 set pm2-logrotate:retain 14
```

## Smoke Test

After deployment, verify homepage, courses, services, gallery, contact, Student Login, direct `/admin/login`, admin dashboard, PDF upload, protected PDF access, enquiry, get started, approval, rejection, approved students, WhatsApp links, and logout.

# DOCQR v2 - Deployment Guide

## Overview

This guide covers deploying DOCQR v2 to various environments.

---

## Prerequisites

- Docker & Docker Compose
- Node.js 20+ (for local builds)
- PostgreSQL 15+ (or Docker)
- Redis 7+ (or Docker)
- MinIO or S3-compatible storage

---

## Local Development

### Quick Start with Docker Compose

```bash
# Clone repository
git clone https://github.com/ranga-tec/DocQR.git
cd DocQR/docqr-v2

# Copy environment file
cp .env.example .env

# Start all services
docker compose up -d

# Run database migrations
cd packages/database
npx prisma migrate deploy
npx prisma db seed

# Start backend (in apps/core)
cd ../../apps/core
npm run start:dev

# Start frontend (in apps/web)
cd ../web
npm run dev
```

### Docker Compose Services

```yaml
# docker-compose.yml services
services:
  postgres:     # Port 5432
  redis:        # Port 6379
  minio:        # Port 9000 (API), 9001 (Console)
  pgadmin:      # Port 5050 (optional)
```

### Service URLs

| Service | URL |
|---------|-----|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:3000/api/v1 |
| Swagger Docs | http://localhost:3000/api/docs |
| MinIO Console | http://localhost:9001 |
| pgAdmin | http://localhost:5050 |

---

## Railway Deployment

Railway is the recommended production platform.

### 1. Create Railway Project

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Initialize project
railway init
```

### 2. Add Services

In Railway dashboard, add:

1. **PostgreSQL** (Plugin)
2. **Redis** (Plugin)
3. **Core Service** (from GitHub repo)

### 3. Configure Environment Variables

In Railway dashboard, set these variables for the Core Service:

```bash
# Required
NODE_ENV=production
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}
JWT_SECRET=<generate-random-256-bit-key>
JWT_REFRESH_SECRET=<generate-different-random-key>

# Storage (choose one)
# Option A: Railway Volume (limited)
USE_LOCAL_STORAGE=true
UPLOADS_DIR=/app/uploads

# Option B: External MinIO/S3
USE_MINIO=true
MINIO_ENDPOINT=your-minio-host.com
MINIO_PORT=443
MINIO_USE_SSL=true
MINIO_ACCESS_KEY=<access-key>
MINIO_SECRET_KEY=<secret-key>
MINIO_BUCKET_DOCUMENTS=documents
MINIO_BUCKET_QRCODES=qr-codes

# Notifications (optional)
SENDGRID_API_KEY=<your-api-key>
SENDGRID_FROM_EMAIL=noreply@yourdomain.com
TWILIO_ACCOUNT_SID=<your-sid>
TWILIO_AUTH_TOKEN=<your-token>
TWILIO_FROM_NUMBER=+1234567890

# App
APP_URL=https://your-app.railway.app
APP_BASE_URL=https://your-app.railway.app
CORS_ORIGIN=https://your-frontend.railway.app
```

### 4. Configure Build Settings

In Railway service settings:

```
Root Directory: docqr-v2
Build Command: npm run build
Start Command: npm run start:prod
```

### 5. Deploy

```bash
# Push to GitHub (auto-deploys)
git push origin main

# Or manual deploy
railway up
```

### 6. Run Migrations

```bash
# In Railway CLI
railway run npx prisma migrate deploy
railway run npx prisma db seed
```

---

## Docker Production Build

### Build Image

```bash
# Build backend
cd apps/core
docker build -t docqr-core:latest .

# Build frontend
cd ../web
docker build -t docqr-web:latest .
```

### Dockerfile (Backend)

```dockerfile
# apps/core/Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

# Copy workspace files
COPY package*.json ./
COPY packages/database ./packages/database
COPY apps/core ./apps/core

# Install dependencies
RUN npm ci

# Generate Prisma client
RUN cd packages/database && npx prisma generate

# Build
RUN cd apps/core && npm run build

# Production image
FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/core/dist ./dist
COPY --from=builder /app/packages/database ./packages/database

ENV NODE_ENV=production

EXPOSE 3000

CMD ["node", "dist/main.js"]
```

### Docker Compose Production

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  core:
    image: docqr-core:latest
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://...
      - REDIS_URL=redis://...
    depends_on:
      - postgres
      - redis
    restart: unless-stopped

  web:
    image: docqr-web:latest
    ports:
      - "80:80"
    depends_on:
      - core
    restart: unless-stopped

  postgres:
    image: postgres:15-alpine
    volumes:
      - postgres_data:/var/lib/postgresql/data
    environment:
      POSTGRES_USER: docqr
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: docqr
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    restart: unless-stopped

  minio:
    image: minio/minio
    command: server /data --console-address ":9001"
    volumes:
      - minio_data:/data
    environment:
      MINIO_ROOT_USER: ${MINIO_ACCESS_KEY}
      MINIO_ROOT_PASSWORD: ${MINIO_SECRET_KEY}
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
  minio_data:
```

---

## Nginx Configuration

### Reverse Proxy Setup

```nginx
# /etc/nginx/sites-available/docqr
server {
    listen 80;
    server_name docqr.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name docqr.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/docqr.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/docqr.yourdomain.com/privkey.pem;

    # Frontend
    location / {
        proxy_pass http://localhost:5173;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Host $host;

        # File upload size
        client_max_body_size 50M;
    }

    # Health check
    location /health {
        proxy_pass http://localhost:3000/health;
    }
}
```

---

## SSL/TLS Setup

### Let's Encrypt with Certbot

```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d docqr.yourdomain.com

# Auto-renewal (cron)
0 0 * * * /usr/bin/certbot renew --quiet
```

---

## Database Migrations

### Production Migration Strategy

```bash
# 1. Backup database first
pg_dump -h localhost -U docqr -d docqr -F c -f backup_$(date +%Y%m%d).dump

# 2. Run migrations
npx prisma migrate deploy

# 3. Verify
npx prisma migrate status
```

### Rollback (if needed)

```bash
# Restore from backup
pg_restore -h localhost -U docqr -d docqr -c backup_20240223.dump
```

---

## Monitoring

### Health Checks

```bash
# Liveness probe
curl http://localhost:3000/health

# Readiness probe
curl http://localhost:3000/health/ready
```

### Logging

Backend logs are structured JSON:

```json
{
  "level": "info",
  "timestamp": "2024-02-23T10:00:00.000Z",
  "context": "DocketsService",
  "message": "Docket created",
  "docketId": "uuid",
  "userId": "uuid"
}
```

Configure log aggregation (e.g., Datadog, Logtail, Papertrail).

### Metrics (Optional)

Add Prometheus metrics:

```typescript
// Add to main.ts
import { PrometheusModule } from '@willsoto/nestjs-prometheus';

@Module({
  imports: [
    PrometheusModule.register({
      path: '/metrics',
    }),
  ],
})
```

---

## Backup Strategy

### Database Backups

```bash
#!/bin/bash
# backup.sh - Run daily via cron

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR=/backups/postgres

# Create backup
pg_dump -h localhost -U docqr -d docqr -F c -f $BACKUP_DIR/docqr_$DATE.dump

# Keep last 7 days
find $BACKUP_DIR -name "*.dump" -mtime +7 -delete

# Upload to S3 (optional)
aws s3 cp $BACKUP_DIR/docqr_$DATE.dump s3://your-bucket/backups/
```

### File Storage Backups

If using MinIO:

```bash
# Sync to backup location
mc mirror minio/documents backup/documents
mc mirror minio/qr-codes backup/qr-codes
```

---

## Scaling

### Horizontal Scaling

```yaml
# docker-compose.scale.yml
services:
  core:
    deploy:
      replicas: 3
```

### Load Balancing

With nginx upstream:

```nginx
upstream docqr_backend {
    least_conn;
    server core1:3000;
    server core2:3000;
    server core3:3000;
}
```

### Database Connection Pooling

Use PgBouncer for high-traffic:

```ini
# pgbouncer.ini
[databases]
docqr = host=localhost port=5432 dbname=docqr

[pgbouncer]
pool_mode = transaction
max_client_conn = 1000
default_pool_size = 20
```

---

## Troubleshooting

### Common Issues

**Database connection refused:**
```bash
# Check PostgreSQL is running
docker ps | grep postgres

# Check connection string
echo $DATABASE_URL
```

**Redis connection error:**
```bash
# Verify Redis is accessible
redis-cli -h localhost -p 6379 ping
```

**File upload fails:**
```bash
# Check MinIO bucket exists
mc ls minio/documents

# Check permissions
mc admin policy info minio readwrite
```

**Migrations fail:**
```bash
# Reset and re-run (CAUTION: data loss)
npx prisma migrate reset

# Check migration status
npx prisma migrate status
```

### Logs

```bash
# Docker logs
docker logs docqr-core -f --tail 100

# Railway logs
railway logs

# System logs
journalctl -u docqr -f
```

---

## Security Checklist

- [ ] Change all default passwords
- [ ] Use strong JWT secrets (256-bit random)
- [ ] Enable HTTPS only
- [ ] Configure CORS properly
- [ ] Set up firewall rules
- [ ] Enable database SSL
- [ ] Regular security updates
- [ ] Backup encryption
- [ ] Audit logging enabled
- [ ] Rate limiting configured

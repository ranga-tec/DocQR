# DOCQR v2 - Configuration Reference

## Overview

DOCQR v2 uses environment variables for configuration. All variables are defined in `.env` files and loaded via the `@nestjs/config` module.

---

## Environment Files

| File | Purpose |
|------|---------|
| `.env` | Main configuration (gitignored) |
| `.env.example` | Template with all variables |
| `.env.test` | Test environment overrides |
| `.env.production` | Production overrides (optional) |

---

## Core Settings

### Server

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `NODE_ENV` | string | `development` | Environment: development, test, production |
| `PORT` | number | `3000` | HTTP server port |
| `API_PREFIX` | string | `/api` | API route prefix |
| `TRUST_PROXY` | boolean | `false` | Trust X-Forwarded-* headers |

### CORS

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `CORS_ORIGIN` | string | `*` | Allowed origins (comma-separated or *) |

Example:
```bash
# Allow all
CORS_ORIGIN=*

# Specific origins
CORS_ORIGIN=http://localhost:5173,https://app.docqr.com
```

---

## Database

### PostgreSQL

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `DATABASE_URL` | string | **required** | PostgreSQL connection URL |
| `DB_USER` | string | `docqr` | Database username |
| `DB_PASSWORD` | string | `docqr_secret` | Database password |
| `DB_NAME` | string | `docqr` | Database name |
| `DB_PORT` | number | `5432` | Database port |

Connection URL format:
```
postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public
```

Example:
```bash
DATABASE_URL=postgresql://docqr:secret@localhost:5432/docqr?schema=public
```

### Connection Pooling (Prisma)

Prisma handles connection pooling automatically. For high traffic:
```bash
DATABASE_URL=postgresql://user:pass@host:5432/db?connection_limit=20&pool_timeout=10
```

---

## Redis

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `REDIS_HOST` | string | `localhost` | Redis host |
| `REDIS_PORT` | number | `6379` | Redis port |
| `REDIS_PASSWORD` | string | - | Redis password (optional) |
| `REDIS_URL` | string | - | Full Redis URL (overrides above) |

Examples:
```bash
# Separate variables
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=secret

# URL format (Railway)
REDIS_URL=redis://:password@host:6379
```

---

## Authentication

### JWT

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `JWT_SECRET` | string | **required** | Access token signing secret |
| `JWT_EXPIRES_IN` | string | `1d` | Access token expiry |
| `JWT_REFRESH_SECRET` | string | **required** | Refresh token signing secret |
| `JWT_REFRESH_EXPIRES_IN` | string | `7d` | Refresh token expiry |

**Security Note**: Generate strong random secrets for production:
```bash
# Generate 256-bit random key
openssl rand -base64 32
```

Expiry formats: `60` (seconds), `2h` (hours), `1d` (days), `7d` (7 days)

---

## File Storage

### Storage Mode

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `USE_LOCAL_STORAGE` | boolean | `false` | Use local filesystem |
| `USE_MINIO` | boolean | `true` | Use MinIO/S3 storage |
| `UPLOADS_DIR` | string | `./uploads` | Local uploads directory |

### MinIO / S3

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `MINIO_ENDPOINT` | string | `localhost` | MinIO/S3 endpoint |
| `MINIO_PORT` | number | `9000` | MinIO port (not needed for S3) |
| `MINIO_USE_SSL` | boolean | `false` | Use HTTPS |
| `MINIO_ACCESS_KEY` | string | `minioadmin` | Access key |
| `MINIO_SECRET_KEY` | string | `minioadmin` | Secret key |
| `MINIO_BUCKET_DOCUMENTS` | string | `documents` | Documents bucket name |
| `MINIO_BUCKET_QRCODES` | string | `qr-codes` | QR codes bucket name |

Examples:
```bash
# Local MinIO
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin

# AWS S3
MINIO_ENDPOINT=s3.amazonaws.com
MINIO_USE_SSL=true
MINIO_ACCESS_KEY=AKIAIOSFODNN7EXAMPLE
MINIO_SECRET_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY

# Cloudflare R2
MINIO_ENDPOINT=<account-id>.r2.cloudflarestorage.com
MINIO_USE_SSL=true
MINIO_ACCESS_KEY=...
MINIO_SECRET_KEY=...
```

---

## File Upload

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `MAX_FILE_SIZE` | number | `52428800` | Max file size in bytes (50MB) |
| `ALLOWED_MIME_TYPES` | string | (see below) | Comma-separated MIME types |

Default allowed MIME types:
```
application/pdf
application/msword
application/vnd.openxmlformats-officedocument.wordprocessingml.document
application/vnd.ms-excel
application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
image/jpeg
image/png
image/gif
image/webp
```

---

## QR Code

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `QR_CODE_SIZE` | number | `300` | QR code size in pixels |
| `QR_CODE_ERROR_CORRECTION` | string | `M` | Error correction level: L, M, Q, H |
| `APP_BASE_URL` | string | `http://localhost:3000` | Base URL for QR links |

---

## Email (SendGrid)

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `SENDGRID_API_KEY` | string | - | SendGrid API key |
| `SENDGRID_FROM_EMAIL` | string | `noreply@docqr.local` | From email address |
| `SENDGRID_FROM_NAME` | string | `DOCQR System` | From display name |

**Note**: If `SENDGRID_API_KEY` is not set, emails are logged to console (dev mode).

Getting API Key:
1. Sign up at https://sendgrid.com
2. Create API key with Mail Send permission
3. Verify sender email/domain

---

## SMS (Twilio)

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `TWILIO_ACCOUNT_SID` | string | - | Twilio Account SID |
| `TWILIO_AUTH_TOKEN` | string | - | Twilio Auth Token |
| `TWILIO_FROM_NUMBER` | string | - | Twilio phone number |

**Note**: If Twilio credentials are not set, SMS are logged to console (dev mode).

Getting Credentials:
1. Sign up at https://twilio.com
2. Get Account SID and Auth Token from Console
3. Purchase a phone number

---

## OnlyOffice (Document Editing)

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `ONLYOFFICE_URL` | string | `http://localhost:8080` | OnlyOffice Document Server URL |
| `ONLYOFFICE_JWT_SECRET` | string | `onlyoffice_jwt_secret` | JWT secret for OnlyOffice |

---

## Rate Limiting

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `RATE_LIMIT_WINDOW_MS` | number | `900000` | Window in ms (15 minutes) |
| `RATE_LIMIT_MAX_REQUESTS` | number | `100` | Max requests per window |

---

## Logging

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `LOG_LEVEL` | string | `debug` | Log level: error, warn, info, debug |

---

## Railway-Specific

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `RAILWAY_ENVIRONMENT` | string | - | Auto-set by Railway |

When `RAILWAY_ENVIRONMENT` is set:
- `TRUST_PROXY` is automatically enabled
- Production optimizations are applied

---

## Docker Compose Variables

These are used by `docker-compose.yml`:

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `DB_USER` | string | `docqr` | PostgreSQL username |
| `DB_PASSWORD` | string | `docqr_secret` | PostgreSQL password |
| `DB_NAME` | string | `docqr` | PostgreSQL database |
| `REDIS_PASSWORD` | string | `redis_secret` | Redis password |
| `PGADMIN_EMAIL` | string | `admin@docqr.local` | pgAdmin email |
| `PGADMIN_PASSWORD` | string | `admin` | pgAdmin password |
| `PGADMIN_PORT` | number | `5050` | pgAdmin port |
| `MINIO_CONSOLE_PORT` | number | `9001` | MinIO console port |
| `ONLYOFFICE_PORT` | number | `8080` | OnlyOffice port |

---

## Frontend Variables

Frontend uses Vite environment variables (prefixed with `VITE_`):

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `VITE_API_URL` | string | `http://localhost:3000/api/v1` | Backend API URL |
| `VITE_APP_NAME` | string | `DOCQR` | Application name |

Create `apps/web/.env.local`:
```bash
VITE_API_URL=http://localhost:3000/api/v1
```

---

## Complete Example

```bash
# .env - Complete configuration

# Server
NODE_ENV=development
PORT=3000
API_PREFIX=/api
TRUST_PROXY=false

# Database
DATABASE_URL=postgresql://docqr:docqr_secret@localhost:5432/docqr

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=redis_secret

# JWT
JWT_SECRET=your-super-secret-jwt-key-minimum-32-characters
JWT_EXPIRES_IN=1d
JWT_REFRESH_SECRET=your-super-secret-refresh-key-minimum-32-characters
JWT_REFRESH_EXPIRES_IN=7d

# Storage
USE_LOCAL_STORAGE=false
USE_MINIO=true
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET_DOCUMENTS=documents
MINIO_BUCKET_QRCODES=qr-codes

# File Upload
MAX_FILE_SIZE=52428800
ALLOWED_MIME_TYPES=application/pdf,image/jpeg,image/png

# QR Code
QR_CODE_SIZE=300
QR_CODE_ERROR_CORRECTION=M
APP_BASE_URL=http://localhost:3000

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# CORS
CORS_ORIGIN=http://localhost:5173

# Email (optional)
SENDGRID_API_KEY=SG.xxxxx
SENDGRID_FROM_EMAIL=noreply@example.com
SENDGRID_FROM_NAME=DOCQR System

# SMS (optional)
TWILIO_ACCOUNT_SID=ACxxxxx
TWILIO_AUTH_TOKEN=xxxxx
TWILIO_FROM_NUMBER=+1234567890

# OnlyOffice (optional)
ONLYOFFICE_URL=http://localhost:8080
ONLYOFFICE_JWT_SECRET=onlyoffice_jwt_secret

# Logging
LOG_LEVEL=debug
```

---

## Production Recommendations

1. **Always set strong secrets**:
   ```bash
   JWT_SECRET=$(openssl rand -base64 32)
   JWT_REFRESH_SECRET=$(openssl rand -base64 32)
   ```

2. **Use HTTPS**:
   ```bash
   MINIO_USE_SSL=true
   APP_BASE_URL=https://yourdomain.com
   ```

3. **Restrict CORS**:
   ```bash
   CORS_ORIGIN=https://app.yourdomain.com
   ```

4. **Enable trust proxy** (if behind load balancer):
   ```bash
   TRUST_PROXY=true
   ```

5. **Reduce log verbosity**:
   ```bash
   LOG_LEVEL=info
   ```

6. **Increase rate limits** (if needed):
   ```bash
   RATE_LIMIT_MAX_REQUESTS=500
   ```

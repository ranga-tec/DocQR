# DOCQR Backend API

Production-ready Document QR Code Management System backend built with Node.js, Express, TypeScript, PostgreSQL, and MinIO.

## Features

- ✅ **Document Management**: Upload, view, update, delete documents
- ✅ **QR Code Generation**: Automatic QR code generation for each document
- ✅ **Category System**: Organize documents with categories
- ✅ **Tag System**: Tag documents for better organization
- ✅ **User Authentication**: JWT-based authentication
- ✅ **Role-Based Access Control**: Admin and User roles
- ✅ **Audit Logging**: Track all user actions
- ✅ **File Storage**: MinIO object storage for documents and QR codes
- ✅ **Advanced Search**: Full-text search with filters
- ✅ **Admin Panel**: User management and system statistics
- ✅ **Rate Limiting**: Protection against abuse
- ✅ **Input Validation**: Comprehensive request validation
- ✅ **Error Handling**: Centralized error handling
- ✅ **Security**: Helmet, CORS, bcrypt password hashing

## Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Language**: TypeScript
- **Database**: PostgreSQL 15
- **Object Storage**: MinIO
- **Cache**: Redis
- **Authentication**: JWT
- **Validation**: express-validator
- **File Upload**: Multer
- **QR Code**: qrcode

## Prerequisites

- Node.js 18+ and npm
- Docker and Docker Compose
- PostgreSQL 15
- MinIO
- Redis

## Installation

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Start Infrastructure (Docker)

```bash
# From project root
docker-compose up -d
```

This will start:
- PostgreSQL (port 5432)
- pgAdmin (port 5050) - Access at http://localhost:5050 (email: admin@docqr.local, password: vesper)
- MinIO (port 9000, console: 9001)
- Redis (port 6379)

### 3. Configure Environment

The `.env` file is already configured for local development. For production, update the following:

- `JWT_SECRET` and `JWT_REFRESH_SECRET`
- `DB_PASSWORD`
- `MINIO_ACCESS_KEY` and `MINIO_SECRET_KEY`
- `CORS_ORIGIN`

### 4. Run Database Migrations

The database schema is automatically initialized when Docker starts via `docker/init-db.sql`.

### 5. Start Development Server

```bash
npm run dev
```

The server will start at http://localhost:3000

## API Endpoints

### Authentication

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - Logout

### Documents

- `POST /api/documents` - Upload document
- `GET /api/documents` - List documents (with filters)
- `GET /api/documents/:id` - Get document by ID
- `GET /api/documents/qr/:qrCode` - Get document by QR code
- `PUT /api/documents/:id` - Update document
- `DELETE /api/documents/:id` - Delete document (soft delete)
- `GET /api/documents/:id/download` - Download document file
- `GET /api/documents/:id/qr` - Download QR code

### Categories

- `POST /api/categories` - Create category (Admin only)
- `GET /api/categories` - List all categories
- `GET /api/categories/:id` - Get category by ID
- `PUT /api/categories/:id` - Update category (Admin only)
- `DELETE /api/categories/:id` - Delete category (Admin only)

### Admin

- `GET /api/admin/users` - List all users
- `GET /api/admin/users/:id` - Get user by ID
- `PUT /api/admin/users/:id` - Update user
- `DELETE /api/admin/users/:id` - Deactivate user
- `GET /api/admin/audit-logs` - View audit logs
- `GET /api/admin/statistics` - Get system statistics

## Default Credentials

After running the database migrations, a default admin user is created:

- **Username**: `admin`
- **Password**: `admin123` (⚠️ CHANGE IN PRODUCTION!)

## Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm test` - Run tests
- `npm run lint` - Lint code

## Project Structure

```
backend/
├── src/
│   ├── config/          # Configuration files
│   │   ├── index.ts     # Main config
│   │   ├── database.ts  # PostgreSQL connection
│   │   ├── minio.ts     # MinIO client
│   │   └── redis.ts     # Redis client
│   ├── controllers/     # Request handlers
│   ├── middleware/      # Express middleware
│   ├── models/          # Data models (future)
│   ├── routes/          # API routes
│   ├── services/        # Business logic
│   ├── utils/           # Utility functions
│   └── server.ts        # Main server file
├── uploads/             # Temporary upload directory
├── .env                 # Environment variables
├── .env.example         # Environment template
├── package.json
└── tsconfig.json
```

## Environment Variables

See `.env.example` for all available environment variables.

## Security Best Practices

1. **Change default passwords** in production
2. **Use strong JWT secrets** (at least 32 characters)
3. **Enable HTTPS** in production
4. **Configure CORS** properly
5. **Set up rate limiting** appropriately
6. **Regular security updates** for dependencies
7. **Use environment variables** for sensitive data
8. **Enable MinIO SSL** in production

## Production Deployment

1. Build the application:
   ```bash
   npm run build
   ```

2. Set `NODE_ENV=production` in `.env`

3. Use a process manager like PM2:
   ```bash
   npm install -g pm2
   pm2 start dist/server.js --name docqr-api
   ```

4. Set up reverse proxy (Nginx/Apache)

5. Configure SSL certificates

6. Set up automated backups for PostgreSQL and MinIO

## Monitoring

- Health check endpoint: `GET /health`
- Monitor PostgreSQL with pgAdmin: http://localhost:5050
- Monitor MinIO console: http://localhost:9001

## License

MIT

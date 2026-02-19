# DOCQR - Document QR Code Management System

A comprehensive, production-ready document management system with automatic QR code generation. Scan documents, generate QR codes, and retrieve documents by scanning the QR codes.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)
![TypeScript](https://img.shields.io/badge/typescript-5.3-blue.svg)

## 🚀 Features

### Core Features
- ✅ **Document Upload & Management**: Upload, view, update, and delete documents
- ✅ **Automatic QR Code Generation**: Each document gets a unique QR code
- ✅ **QR Code Scanning**: Scan QR codes to instantly retrieve documents
- ✅ **Category System**: Organize documents with categories (optional)
- ✅ **Tagging System**: Add multiple tags to documents for better organization
- ✅ **Advanced Search**: Full-text search with filters (category, tags, date range, creator)
- ✅ **File Storage**: MinIO object storage for scalable document storage

### User Management
- ✅ **Authentication**: Secure JWT-based authentication
- ✅ **Role-Based Access Control**: Admin and User roles
- ✅ **User Profiles**: Track created by, modified by, timestamps

### Admin Features
- ✅ **Full Admin Panel**: Complete administrative control
- ✅ **User Management**: Create, update, deactivate users
- ✅ **Category Management**: Manage document categories
- ✅ **Audit Logging**: Complete audit trail of all actions
- ✅ **System Statistics**: Dashboard with usage statistics

### Security & Performance
- ✅ **Security**: Helmet, CORS, bcrypt, input validation, rate limiting
- ✅ **Audit Trail**: Track all CRUD operations with user, IP, timestamp
- ✅ **Soft Delete**: Documents are soft-deleted for data recovery
- ✅ **Caching**: Redis caching for improved performance
- ✅ **Compression**: Response compression for faster delivery

## 🏗️ Architecture

### Technology Stack

#### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Language**: TypeScript
- **Database**: PostgreSQL 15
- **Object Storage**: MinIO
- **Cache**: Redis 7
- **Authentication**: JWT (jsonwebtoken)
- **File Upload**: Multer
- **QR Code**: qrcode library

#### Frontend (To be implemented)
- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite
- **State Management**: Zustand
- **HTTP Client**: Axios
- **Forms**: React Hook Form
- **Styling**: Tailwind CSS
- **QR Scanner**: html5-qrcode

#### Infrastructure
- **Containerization**: Docker + Docker Compose
- **Database Admin**: pgAdmin 4 (password: vesper)
- **Reverse Proxy**: Nginx (production)

### Database Schema

#### Tables
1. **users** - User accounts with authentication
2. **document_categories** - Document categories (optional)
3. **documents** - Document metadata and file references
4. **document_tags** - Tags for documents (many-to-many)
5. **audit_logs** - Complete audit trail

See `docker/init-db.sql` for complete schema.

## 📦 Installation

### Prerequisites

- Node.js 18+ and npm
- Docker and Docker Compose
- Git

### Quick Start

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd DOCQR
   ```

2. **Start infrastructure services**
   ```bash
   docker-compose up -d
   ```

   This starts:
   - PostgreSQL (port 5432)
   - pgAdmin (port 5050) - http://localhost:5050
   - MinIO (ports 9000, 9001) - http://localhost:9001
   - Redis (port 6379)

3. **Install backend dependencies**
   ```bash
   cd backend
   npm install
   ```

4. **Start backend server**
   ```bash
   npm run dev
   ```

   Backend API: http://localhost:3000

5. **Install frontend dependencies** (when implemented)
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

   Frontend: http://localhost:5173

## 🔐 Default Credentials

### Application
- **Username**: `admin`
- **Password**: `admin123` ⚠️ **CHANGE IN PRODUCTION!**

### pgAdmin
- **Email**: `admin@docqr.local`
- **Password**: `vesper`

### MinIO Console
- **Access Key**: `minioadmin`
- **Secret Key**: `minioadmin123`

## 📚 API Documentation

### Base URL
```
http://localhost:3000/api
```

### Authentication Endpoints

#### Register
```http
POST /api/auth/register
Content-Type: application/json

{
  "username": "johndoe",
  "email": "john@example.com",
  "password": "password123",
  "role": "user"
}
```

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "johndoe",
  "password": "password123"
}
```

Response:
```json
{
  "message": "Login successful",
  "user": {
    "id": "uuid",
    "username": "johndoe",
    "email": "john@example.com",
    "role": "user"
  },
  "token": "jwt-token"
}
```

### Document Endpoints

#### Upload Document
```http
POST /api/documents
Authorization: Bearer {token}
Content-Type: multipart/form-data

file: [binary]
title: "Contract Agreement"
description: "Client contract for 2024"
categoryId: "uuid" (optional)
tags: "contract,2024,important" (optional)
```

Response:
```json
{
  "message": "Document uploaded successfully",
  "document": {
    "id": "uuid",
    "title": "Contract Agreement",
    "description": "Client contract for 2024",
    "file_name": "contract.pdf",
    "file_size": 1024000,
    "qr_code_data": "http://localhost:5173/document/uuid",
    "tags": ["contract", "2024", "important"],
    "created_at": "2024-01-01T00:00:00Z",
    "created_by_username": "johndoe"
  }
}
```

#### List Documents
```http
GET /api/documents?search=contract&categoryId=uuid&page=1&limit=20
Authorization: Bearer {token}
```

#### Get Document by QR Code
```http
GET /api/documents/qr/{encoded-qr-data}
Authorization: Bearer {token}
```

#### Download Document
```http
GET /api/documents/{id}/download
Authorization: Bearer {token}
```

#### Download QR Code
```http
GET /api/documents/{id}/qr
Authorization: Bearer {token}
```

### Category Endpoints

#### Create Category (Admin only)
```http
POST /api/categories
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Contracts",
  "description": "Legal contracts and agreements"
}
```

#### List Categories
```http
GET /api/categories
Authorization: Bearer {token}
```

### Admin Endpoints

#### Get System Statistics
```http
GET /api/admin/statistics
Authorization: Bearer {admin-token}
```

Response:
```json
{
  "statistics": {
    "totalUsers": 10,
    "totalDocuments": 150,
    "totalCategories": 5,
    "totalStorageBytes": 52428800,
    "documentsPerDay": [...],
    "documentsByCategory": [...]
  }
}
```

#### Get Audit Logs
```http
GET /api/admin/audit-logs?page=1&limit=50
Authorization: Bearer {admin-token}
```

## 🗂️ Project Structure

```
DOCQR/
├── backend/                 # Backend API
│   ├── src/
│   │   ├── config/         # Configuration (DB, MinIO, Redis)
│   │   ├── controllers/    # Request handlers
│   │   ├── middleware/     # Express middleware
│   │   ├── routes/         # API routes
│   │   ├── services/       # Business logic
│   │   ├── utils/          # Utility functions
│   │   └── server.ts       # Main server file
│   ├── uploads/            # Temporary uploads
│   ├── .env                # Environment variables
│   ├── package.json
│   └── tsconfig.json
├── frontend/               # Frontend application (to be implemented)
├── docker/                 # Docker configuration
│   └── init-db.sql        # Database schema
├── docker-compose.yml      # Docker services
├── IMPLEMENTATION_PLAN.md  # Detailed implementation plan
└── README.md              # This file
```

## 🔧 Configuration

### Environment Variables

Key environment variables (see `backend/.env`):

```env
# Server
PORT=3000
API_PREFIX=/api

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=docqr_db
DB_USER=docqr_user
DB_PASSWORD=docqr_password

# MinIO
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin123

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d

# File Upload
MAX_FILE_SIZE=52428800
ALLOWED_FILE_TYPES=pdf,doc,docx,xls,xlsx,ppt,pptx,jpg,jpeg,png,gif,txt,csv

# QR Code
QR_CODE_SIZE=300
APP_BASE_URL=http://localhost:5173
```

## 🚀 Deployment

### Production Checklist

- [ ] Change all default passwords
- [ ] Use strong JWT secrets (32+ characters)
- [ ] Enable HTTPS/SSL
- [ ] Configure CORS properly
- [ ] Set up reverse proxy (Nginx)
- [ ] Configure MinIO with SSL
- [ ] Set up automated backups
- [ ] Configure monitoring (Prometheus/Grafana)
- [ ] Set up logging (ELK stack)
- [ ] Enable rate limiting
- [ ] Configure CDN for static assets

### Docker Production Deployment

1. Build backend:
   ```bash
   cd backend
   npm run build
   ```

2. Update `docker-compose.yml` for production

3. Start services:
   ```bash
   docker-compose -f docker-compose.prod.yml up -d
   ```

## 📊 Database Management

### Access pgAdmin
1. Open http://localhost:5050
2. Login with:
   - Email: `admin@docqr.local`
   - Password: `vesper`
3. Add server:
   - Host: `postgres` (Docker network) or `localhost`
   - Port: `5432`
   - Database: `docqr_db`
   - Username: `docqr_user`
   - Password: `docqr_password`

### Backup Database
```bash
docker exec docqr_postgres pg_dump -U docqr_user docqr_db > backup.sql
```

### Restore Database
```bash
docker exec -i docqr_postgres psql -U docqr_user docqr_db < backup.sql
```

## 🧪 Testing

```bash
cd backend
npm test
```

## 📝 License

MIT License - see LICENSE file for details

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📞 Support

For issues and questions, please open an issue on GitHub.

## 🎯 Roadmap

- [x] Backend API implementation
- [x] Database schema and migrations
- [x] QR code generation
- [x] Authentication and authorization
- [x] Admin panel backend
- [ ] Frontend React application
- [ ] QR code scanner UI
- [ ] Document viewer
- [ ] Admin dashboard UI
- [ ] Mobile app (React Native)
- [ ] OCR integration
- [ ] Document versioning
- [ ] Collaborative features
- [ ] Advanced analytics

---

**Built with ❤️ for efficient document management**

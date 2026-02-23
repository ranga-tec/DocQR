# DOCQR v2 - Hybrid Physical-to-Digital Document Workflow System

A comprehensive document management and workflow system that bridges physical and digital document handling with QR code tracking, role-based access control, and collaborative editing.

## Features

- **Docket-Centric Architecture** - Documents organized as dockets (folders) containing multiple attachments
- **Workflow Engine** - Full state machine with unlimited forwarding chains
- **RBAC** - Role-based access (Admin, Clerk, Recipient, Approver)
- **Secure QR Codes** - Tokenized QR codes for physical-digital linking
- **Real-time Editing** - Collaborative document editing via OnlyOffice
- **Notifications** - Email (SendGrid) and SMS (Twilio) notifications
- **Physical Register** - Link physical book entries to digital dockets
- **Audit Trail** - Complete tracking of all actions
- **SLA Monitoring** - Track due dates and SLA compliance

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        API GATEWAY                               │
└─────────────────────────────────────────────────────────────────┘
           │              │              │              │
           ▼              ▼              ▼              ▼
┌──────────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│   CORE SERVICE   │ │   DOCUMENT  │ │NOTIFICATION │ │   SIGNING   │
│   (NestJS)       │ │  PROCESSOR  │ │   SERVICE   │ │  (Phase 2)  │
└──────────────────┘ └─────────────┘ └─────────────┘ └─────────────┘
         │
         ▼
┌──────────────────┐  ┌─────────────┐  ┌─────────────┐
│   PostgreSQL     │  │    MinIO    │  │    Redis    │
└──────────────────┘  └─────────────┘  └─────────────┘
```

## Tech Stack

- **Backend**: NestJS (TypeScript)
- **Database**: PostgreSQL 15 + Prisma ORM
- **Cache/Queue**: Redis + BullMQ
- **Storage**: MinIO (S3-compatible) / Local
- **Document Editing**: OnlyOffice Community Edition
- **Email**: SendGrid
- **SMS**: Twilio
- **Deployment**: Docker + Railway

## Project Structure

```
docqr-v2/
├── apps/
│   ├── core/                # NestJS backend
│   │   └── src/
│   │       ├── modules/     # Feature modules
│   │       ├── common/      # Shared guards, decorators
│   │       └── config/      # Configuration
│   ├── web/                 # React frontend
│   │   └── src/
│   │       ├── components/  # UI components
│   │       ├── pages/       # Page components
│   │       ├── hooks/       # Custom hooks
│   │       └── lib/         # API client, utilities
│   └── doc-processor/       # Document processing (Phase 2)
├── packages/
│   ├── database/            # Prisma schema & client
│   └── shared/              # Shared types & enums
├── docker/                  # Docker configurations
└── .env.example            # Environment template
```

## Getting Started

### Prerequisites

- Node.js 20+
- Docker & Docker Compose
- Git

### Installation

1. Clone the repository:
```bash
git clone https://github.com/ranga-tec/DocQR.git
cd DocQR/docqr-v2
```

2. Install dependencies:
```bash
npm install
```

3. Copy environment file:
```bash
cp .env.example .env
# Edit .env with your values
```

4. Start infrastructure services:
```bash
npm run docker:up
```

5. Generate Prisma client & run migrations:
```bash
npm run db:generate
npm run db:migrate
```

6. Seed the database:
```bash
cd packages/database && npm run seed
```

7. Start development server:
```bash
npm run dev:core
```

### Docker Services

```bash
# Start core services (PostgreSQL, Redis, MinIO)
docker-compose -f docker/docker-compose.yml up -d

# Start with pgAdmin (development)
docker-compose -f docker/docker-compose.yml --profile dev up -d

# Start with OnlyOffice (full stack)
docker-compose -f docker/docker-compose.yml --profile full up -d
```

### Access Points

- **API**: http://localhost:3000/api/v1
- **Swagger Docs**: http://localhost:3000/api/docs
- **Health Check**: http://localhost:3000/health
- **pgAdmin**: http://localhost:5050
- **MinIO Console**: http://localhost:9001
- **OnlyOffice**: http://localhost:8080

## API Endpoints

### Authentication
- `POST /api/v1/auth/login` - Login
- `POST /api/v1/auth/register` - Register
- `POST /api/v1/auth/refresh` - Refresh token
- `GET /api/v1/auth/me` - Get profile

### Dockets
- `GET /api/v1/dockets` - List dockets
- `POST /api/v1/dockets` - Create docket
- `GET /api/v1/dockets/:id` - Get docket
- `PUT /api/v1/dockets/:id` - Update docket
- `DELETE /api/v1/dockets/:id` - Delete docket

### Workflow Actions
- `POST /api/v1/dockets/:id/forward` - Forward docket
- `POST /api/v1/dockets/:id/approve` - Approve docket
- `POST /api/v1/dockets/:id/reject` - Reject docket
- `POST /api/v1/dockets/:id/close` - Close docket
- `GET /api/v1/dockets/:id/history` - Workflow history

### Attachments
- `GET /api/v1/dockets/:id/attachments` - List attachments
- `POST /api/v1/dockets/:id/attachments` - Upload attachment
- `GET /api/v1/dockets/:id/attachments/:aid/download` - Download

### QR Code
- `GET /api/v1/dockets/:id/qr` - Download QR code
- `GET /api/v1/dockets/qr/:token` - Lookup by QR token
- `POST /api/v1/dockets/:id/regenerate-qr` - Regenerate QR

## Default Credentials

After seeding:
- **Admin**: admin@docqr.local / admin123

## Workflow States

```
OPEN → IN_REVIEW → FORWARDED ↔ (chain)
         ↓
    PENDING_APPROVAL
         ↓
   APPROVED / REJECTED
         ↓
      CLOSED → ARCHIVED
```

## Documentation

Comprehensive documentation is available in the [docs/](docs/) folder:

| Document | Description |
|----------|-------------|
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | System architecture, design patterns, security |
| [API.md](docs/API.md) | Complete API reference with examples |
| [DATABASE.md](docs/DATABASE.md) | Database schema, tables, relationships |
| [MODULES.md](docs/MODULES.md) | Backend module documentation |
| [FRONTEND.md](docs/FRONTEND.md) | React frontend architecture and components |
| [DEPLOYMENT.md](docs/DEPLOYMENT.md) | Deployment guide (Railway, Docker, etc.) |
| [DEVELOPMENT.md](docs/DEVELOPMENT.md) | Development workflow and best practices |
| [CONFIGURATION.md](docs/CONFIGURATION.md) | Environment variables reference |

## License

MIT

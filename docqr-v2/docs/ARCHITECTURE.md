# DOCQR v2 - Technical Architecture

## System Overview

DOCQR v2 is a hybrid physical-to-digital document workflow system designed to digitize incoming physical documents, maintain traceability between physical and electronic records, and enable secure routing, commenting, and decision-making.

## Architecture Pattern

### Hybrid Microservices

We use a **hybrid architecture** that combines:
- **Modular Monolith** for core business logic (tightly coupled domain)
- **Separate Services** for specialized, independently scalable components

```
┌─────────────────────────────────────────────────────────────────┐
│                     NGINX / API GATEWAY                          │
│              (Rate Limiting, SSL, Load Balancing)                │
└─────────────────────────────────────────────────────────────────┘
                              │
           ┌──────────────────┼──────────────────┐
           │                  │                  │
           ▼                  ▼                  ▼
┌──────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│   CORE SERVICE   │ │ DOCUMENT PROC.  │ │  NOTIFICATION   │
│   (NestJS)       │ │   SERVICE       │ │    SERVICE      │
│                  │ │                 │ │                 │
│ • Authentication │ │ • OnlyOffice    │ │ • SendGrid      │
│ • Authorization  │ │ • PDF Convert   │ │ • Twilio        │
│ • Dockets        │ │ • Word Edit     │ │ • Push          │
│ • Workflow       │ │ • Thumbnails    │ │ • Queue Worker  │
│ • Comments       │ │                 │ │                 │
│ • Registers      │ │                 │ │                 │
│ • Admin          │ │                 │ │                 │
└────────┬─────────┘ └────────┬────────┘ └────────┬────────┘
         │                    │                   │
         └────────────────────┼───────────────────┘
                              │
         ┌────────────────────┼────────────────────┐
         │                    │                    │
         ▼                    ▼                    ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│   PostgreSQL    │ │     MinIO       │ │     Redis       │
│                 │ │   (Storage)     │ │  (Cache/Queue)  │
│ • Users         │ │                 │ │                 │
│ • Dockets       │ │ • Documents     │ │ • Sessions      │
│ • Workflow      │ │ • QR Codes      │ │ • Job Queues    │
│ • Audit Logs    │ │ • Attachments   │ │ • Rate Limits   │
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

## Core Concepts

### 1. Docket (Primary Container)

A **Docket** is the primary entity - a logical folder representing one incoming matter.

```typescript
Docket {
  id: UUID
  docketNumber: "DOC/2024/000001"  // Auto-generated
  qrToken: "cryptographically-random-token"  // Secure QR data
  subject: string
  description: string
  status: DocketStatus  // Workflow state
  priority: Priority
  confidentiality: Confidentiality
  currentAssigneeId: UUID  // Current owner
  currentDepartmentId: UUID
  dueDate: DateTime
  slaStatus: SlaStatus

  // Contains
  attachments: Attachment[]
  comments: Comment[]
  assignments: Assignment[]  // Forwarding chain
}
```

### 2. Workflow States

```
                    ┌─────────┐
                    │  OPEN   │
                    └────┬────┘
                         │ start_review / forward
              ┌──────────┼──────────┐
              ▼          │          ▼
        ┌──────────┐     │    ┌───────────┐
        │IN_REVIEW │     │    │ FORWARDED │◄────┐
        └────┬─────┘     │    └─────┬─────┘     │
             │           │          │           │
             │ submit    │          │ forward   │
             ▼           │          └───────────┘
    ┌─────────────────┐  │
    │PENDING_APPROVAL │  │
    └────────┬────────┘  │
             │           │
      ┌──────┴──────┐    │
      ▼             ▼    │
┌──────────┐  ┌──────────┐
│ APPROVED │  │ REJECTED │
└────┬─────┘  └────┬─────┘
     │             │
     └──────┬──────┘
            ▼
      ┌──────────┐
      │  CLOSED  │
      └────┬─────┘
           │ archive
           ▼
      ┌──────────┐
      │ ARCHIVED │
      └──────────┘
```

### 3. Role-Based Access Control (RBAC)

```
┌─────────────┬────────────────────────────────────────────────────┐
│    Role     │                    Permissions                     │
├─────────────┼────────────────────────────────────────────────────┤
│   Admin     │ * (all permissions)                                │
├─────────────┼────────────────────────────────────────────────────┤
│   Clerk     │ docket:create, docket:view, attachment:upload,     │
│             │ register:manage                                    │
├─────────────┼────────────────────────────────────────────────────┤
│  Recipient  │ docket:view, docket:comment, attachment:view       │
├─────────────┼────────────────────────────────────────────────────┤
│  Approver   │ docket:view, docket:approve, docket:reject,        │
│             │ docket:forward, docket:comment                     │
└─────────────┴────────────────────────────────────────────────────┘
```

## Database Schema

### Entity Relationship Diagram

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│    User     │────<│  UserRole    │>────│    Role     │
└──────┬──────┘     └──────────────┘     └─────────────┘
       │
       │ 1:N
       ▼
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Docket    │────<│  Attachment  │     │ DocketType  │
└──────┬──────┘     └──────────────┘     └─────────────┘
       │
       │ 1:N                              ┌─────────────┐
       ├─────────────────────────────────>│   Comment   │
       │                                  └─────────────┘
       │ 1:N
       ├─────────────────────────────────>┌─────────────┐
       │                                  │ Assignment  │
       │                                  └─────────────┘
       │ 1:1
       └─────────────────────────────────>┌─────────────────────┐
                                          │ WorkflowInstance    │
                                          └──────────┬──────────┘
                                                     │ 1:N
                                                     ▼
                                          ┌─────────────────────┐
                                          │ WorkflowTransition  │
                                          └─────────────────────┘
```

### Key Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `users` | User accounts | email, username, passwordHash |
| `roles` | RBAC roles | name, permissions (JSONB) |
| `departments` | Org hierarchy | code, parentId, headUserId |
| `dockets` | Primary container | docketNumber, qrToken, status |
| `docket_attachments` | Files | storageKey, mimeType, version |
| `docket_comments` | Immutable notes | content, commentType |
| `docket_assignments` | Forward chain | sequenceNumber, status |
| `workflow_instances` | Active workflow | currentState |
| `workflow_transitions` | History | fromState, toState, action |
| `notifications` | User alerts | title, message, channels |
| `audit_logs` | Activity tracking | action, resourceType, details |

## Security Architecture

### Authentication Flow

```
┌──────────┐     POST /auth/login      ┌──────────────┐
│  Client  │─────────────────────────>│  Auth Module  │
└──────────┘                          └───────┬───────┘
     ▲                                        │
     │  { accessToken, refreshToken }         │ Validate credentials
     │                                        ▼
     │                                ┌───────────────┐
     └────────────────────────────────│   Database    │
                                      │  (bcrypt)     │
                                      └───────────────┘
```

### Token Strategy

- **Access Token**: JWT, 1 day expiry, contains user ID + roles
- **Refresh Token**: UUID stored in database, 7 day expiry
- **QR Token**: Cryptographically random, no expiry, regeneratable

### QR Code Security

```
Traditional (Insecure):
  QR contains: https://app.com/docket/123e4567-e89b

DOCQR v2 (Secure):
  QR contains: https://app.com/scan/Xk9mN2pL8qR4sT6u
                                    └── Random token (no ID exposure)
```

## API Design

### RESTful Endpoints

```
Authentication:
  POST   /api/v1/auth/login
  POST   /api/v1/auth/register
  POST   /api/v1/auth/refresh
  GET    /api/v1/auth/me

Dockets:
  GET    /api/v1/dockets              # List (paginated, filtered)
  POST   /api/v1/dockets              # Create
  GET    /api/v1/dockets/:id          # Get by ID
  PUT    /api/v1/dockets/:id          # Update
  DELETE /api/v1/dockets/:id          # Soft delete

QR:
  GET    /api/v1/dockets/qr/:token    # Lookup by QR token
  GET    /api/v1/dockets/:id/qr       # Download QR image
  POST   /api/v1/dockets/:id/regenerate-qr

Workflow:
  POST   /api/v1/dockets/:id/forward
  POST   /api/v1/dockets/:id/approve
  POST   /api/v1/dockets/:id/reject
  POST   /api/v1/dockets/:id/close
  GET    /api/v1/dockets/:id/history
  GET    /api/v1/dockets/:id/actions  # Allowed actions

Attachments:
  GET    /api/v1/dockets/:id/attachments
  POST   /api/v1/dockets/:id/attachments  # Upload
  GET    /api/v1/dockets/:id/attachments/:aid/download

Comments:
  GET    /api/v1/dockets/:id/comments
  POST   /api/v1/dockets/:id/comments  # Immutable
```

### Response Format

```json
{
  "data": { ... },
  "meta": {
    "total": 100,
    "page": 1,
    "limit": 20,
    "totalPages": 5
  }
}
```

## Deployment Architecture

### Railway Configuration

```
┌─────────────────────────────────────────────────────────┐
│                    Railway Project                       │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │   Core      │  │  PostgreSQL │  │    Redis    │     │
│  │  Service    │  │   (Plugin)  │  │  (Plugin)   │     │
│  │  (Docker)   │  │             │  │             │     │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘     │
│         │                │                │             │
│         └────────────────┼────────────────┘             │
│                          │                              │
│  ┌───────────────────────┼───────────────────────┐     │
│  │              Internal Network                  │     │
│  └───────────────────────┼───────────────────────┘     │
│                          │                              │
│  ┌───────────────────────┼───────────────────────┐     │
│  │         External (MinIO / S3 / R2)            │     │
│  └───────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────┘
```

### Environment Variables

See `.env.example` for complete list. Critical variables:

```bash
# Required for production
DATABASE_URL=postgresql://...
JWT_SECRET=<random-256-bit>
JWT_REFRESH_SECRET=<random-256-bit>
MINIO_ACCESS_KEY=<access-key>
MINIO_SECRET_KEY=<secret-key>
SENDGRID_API_KEY=<api-key>
```

## Performance Considerations

### Database Indexes

```sql
-- Docket lookups
CREATE INDEX idx_dockets_docket_number ON dockets(docket_number);
CREATE INDEX idx_dockets_qr_token ON dockets(qr_token);
CREATE INDEX idx_dockets_status ON dockets(status);
CREATE INDEX idx_dockets_current_assignee ON dockets(current_assignee_id);

-- Full-text search
CREATE INDEX idx_dockets_subject_search
  ON dockets USING gin(to_tsvector('english', subject));
```

### Caching Strategy

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Request   │────>│    Redis    │────>│  PostgreSQL │
└─────────────┘     │   (Cache)   │     └─────────────┘
                    └─────────────┘

Cache Keys:
  - user:{id}:profile (TTL: 5min)
  - docket:{id}:basic (TTL: 1min)
  - permissions:{userId} (TTL: 10min)
```

## Future Considerations

### Phase 2: Digital Signing

```
┌──────────────┐     ┌──────────────┐
│   DOCQR v2   │────>│ Signing Svc  │
└──────────────┘     └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
        ┌──────────┐ ┌──────────┐ ┌──────────┐
        │  SigNEX  │ │StellaSign│ │ Internal │
        └──────────┘ └──────────┘ └──────────┘
```

### Scalability Path

1. **Horizontal Scaling**: Add more Core Service instances behind load balancer
2. **Database Scaling**: Read replicas for reporting queries
3. **Queue Workers**: Scale notification workers independently
4. **CDN**: Serve static assets and QR codes via CDN

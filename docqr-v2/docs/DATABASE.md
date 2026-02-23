# DOCQR v2 - Database Schema Documentation

## Overview

DOCQR v2 uses **PostgreSQL** with **Prisma ORM**. The schema follows these principles:
- Soft deletes via `deletedAt` timestamp
- Audit trails via `createdAt`, `updatedAt`, `createdById`
- JSONB for flexible metadata storage
- UUID primary keys for security

## Schema Location

```
packages/database/prisma/schema.prisma
```

## Running Migrations

```bash
# Development - create and apply migrations
cd packages/database
npx prisma migrate dev --name "description_of_change"

# Production - apply migrations only
npx prisma migrate deploy

# Reset database (DESTRUCTIVE)
npx prisma migrate reset

# Generate Prisma Client
npx prisma generate
```

---

## Core Tables

### Users

Stores user accounts and authentication data.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| email | VARCHAR(255) | Unique email address |
| username | VARCHAR(50) | Unique username |
| passwordHash | TEXT | bcrypt hashed password |
| firstName | VARCHAR(100) | First name |
| lastName | VARCHAR(100) | Last name |
| phone | VARCHAR(20) | Phone number (optional) |
| avatarUrl | TEXT | Profile picture URL |
| isActive | BOOLEAN | Account active status |
| emailVerified | BOOLEAN | Email verification status |
| lastLoginAt | TIMESTAMP | Last login timestamp |
| createdAt | TIMESTAMP | Creation timestamp |
| updatedAt | TIMESTAMP | Last update timestamp |
| deletedAt | TIMESTAMP | Soft delete timestamp |

**Indexes:**
- `idx_users_email` - Unique index on email
- `idx_users_username` - Unique index on username

---

### Roles

Defines RBAC roles with permissions.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| name | VARCHAR(50) | Role name (admin, clerk, etc.) |
| displayName | VARCHAR(100) | Human-readable name |
| description | TEXT | Role description |
| permissions | JSONB | Array of permission strings |
| isSystem | BOOLEAN | System role (cannot delete) |
| createdAt | TIMESTAMP | Creation timestamp |
| updatedAt | TIMESTAMP | Last update timestamp |

**Default Roles:**
```json
[
  { "name": "admin", "permissions": ["*"] },
  { "name": "clerk", "permissions": ["docket:create", "docket:view", "attachment:upload"] },
  { "name": "recipient", "permissions": ["docket:view", "docket:comment", "attachment:view"] },
  { "name": "approver", "permissions": ["docket:view", "docket:approve", "docket:reject", "docket:forward"] }
]
```

---

### UserRoles

Junction table for user-role assignments.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| userId | UUID | FK to users |
| roleId | UUID | FK to roles |
| assignedAt | TIMESTAMP | Assignment timestamp |
| assignedById | UUID | Who assigned this role |

---

### Departments

Organizational hierarchy.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| name | VARCHAR(100) | Department name |
| code | VARCHAR(20) | Short code (ADMIN, HR, LEGAL) |
| description | TEXT | Department description |
| parentId | UUID | Parent department (nullable) |
| headUserId | UUID | Department head (nullable) |
| isActive | BOOLEAN | Active status |
| createdAt | TIMESTAMP | Creation timestamp |
| updatedAt | TIMESTAMP | Last update timestamp |
| deletedAt | TIMESTAMP | Soft delete timestamp |

**Indexes:**
- `idx_departments_code` - Unique index on code
- `idx_departments_parent` - Index on parentId for hierarchy queries

---

### UserDepartments

Junction table for user-department assignments.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| userId | UUID | FK to users |
| departmentId | UUID | FK to departments |
| isPrimary | BOOLEAN | Primary department flag |
| assignedAt | TIMESTAMP | Assignment timestamp |

---

## Docket Tables

### DocketTypes

Categorizes dockets (Contract, Memo, Report, etc.).

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| name | VARCHAR(100) | Type name |
| code | VARCHAR(20) | Short code |
| description | TEXT | Type description |
| prefix | VARCHAR(10) | Docket number prefix |
| slaHours | INTEGER | Default SLA in hours |
| requiresApproval | BOOLEAN | Requires approval workflow |
| customFields | JSONB | Custom field definitions |
| isActive | BOOLEAN | Active status |
| createdAt | TIMESTAMP | Creation timestamp |
| updatedAt | TIMESTAMP | Last update timestamp |

---

### Dockets

Primary entity - represents a document folder.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| docketNumber | VARCHAR(50) | Auto-generated number (DOC/2024/000001) |
| qrToken | VARCHAR(100) | Secure QR code token |
| subject | VARCHAR(500) | Docket subject |
| description | TEXT | Detailed description |
| priority | ENUM | LOW, MEDIUM, HIGH, URGENT |
| confidentiality | ENUM | PUBLIC, INTERNAL, CONFIDENTIAL, SECRET |
| status | ENUM | Workflow status |
| docketTypeId | UUID | FK to docket_types |
| departmentId | UUID | Owning department |
| currentDepartmentId | UUID | Current handling department |
| createdById | UUID | Creator user |
| currentAssigneeId | UUID | Current handler |
| dueDate | TIMESTAMP | Due date/time |
| slaStatus | ENUM | ON_TRACK, AT_RISK, OVERDUE |
| slaDeadline | TIMESTAMP | Calculated SLA deadline |
| physicalLocation | VARCHAR(255) | Physical storage location |
| barcode | VARCHAR(100) | Physical barcode |
| tags | JSONB | Array of tag strings |
| customFields | JSONB | Custom field values |
| externalRef | VARCHAR(100) | External reference number |
| createdAt | TIMESTAMP | Creation timestamp |
| updatedAt | TIMESTAMP | Last update timestamp |
| deletedAt | TIMESTAMP | Soft delete timestamp |

**Indexes:**
- `idx_dockets_number` - Unique on docketNumber
- `idx_dockets_qr_token` - Unique on qrToken
- `idx_dockets_status` - For status filtering
- `idx_dockets_assignee` - For inbox queries
- `idx_dockets_department` - For department views
- `idx_dockets_created_at` - For sorting
- `idx_dockets_fts` - Full-text search on subject + description

**Status Values:**
```
OPEN, IN_REVIEW, FORWARDED, PENDING_APPROVAL,
APPROVED, REJECTED, CLOSED, ARCHIVED
```

---

### DocketAttachments

Files attached to dockets.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| docketId | UUID | FK to dockets |
| fileName | VARCHAR(255) | Storage path/key |
| originalFileName | VARCHAR(255) | Original file name |
| fileSize | BIGINT | Size in bytes |
| mimeType | VARCHAR(100) | MIME type |
| storageType | ENUM | LOCAL, MINIO, S3 |
| storageKey | VARCHAR(500) | Full storage path |
| checksum | VARCHAR(64) | SHA-256 hash |
| isPrimary | BOOLEAN | Primary document flag |
| version | INTEGER | Version number |
| uploadedById | UUID | Uploader user |
| createdAt | TIMESTAMP | Upload timestamp |
| deletedAt | TIMESTAMP | Soft delete timestamp |

---

### DocketComments

Immutable comment thread on dockets.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| docketId | UUID | FK to dockets |
| authorId | UUID | Comment author |
| content | TEXT | Comment content |
| commentType | ENUM | Type of comment |
| attachmentId | UUID | Related attachment (optional) |
| parentCommentId | UUID | Reply to comment (optional) |
| isInternal | BOOLEAN | Internal only flag |
| createdAt | TIMESTAMP | Creation timestamp |

**Comment Types:**
```
NOTE, OBSERVATION, INSTRUCTION, QUERY,
RESPONSE, DECISION, SYSTEM
```

**Note:** Comments are immutable - no update or delete operations.

---

### DocketAssignments

Forwarding chain - tracks who handled the docket.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| docketId | UUID | FK to dockets |
| sequenceNumber | INTEGER | Order in chain |
| fromUserId | UUID | Previous handler |
| toUserId | UUID | New handler |
| fromDepartmentId | UUID | Previous department |
| toDepartmentId | UUID | New department |
| action | ENUM | FORWARD, RETURN, ACCEPT |
| instructions | TEXT | Instructions for recipient |
| status | ENUM | PENDING, ACCEPTED, REJECTED |
| acceptedAt | TIMESTAMP | When accepted |
| createdAt | TIMESTAMP | Assignment timestamp |

---

## Workflow Tables

### WorkflowDefinitions

Defines workflow templates.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| name | VARCHAR(100) | Workflow name |
| description | TEXT | Description |
| states | JSONB | State definitions |
| transitions | JSONB | Allowed transitions |
| isDefault | BOOLEAN | Default workflow |
| isActive | BOOLEAN | Active status |
| createdAt | TIMESTAMP | Creation timestamp |
| updatedAt | TIMESTAMP | Last update timestamp |

---

### WorkflowInstances

Active workflow for a docket.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| docketId | UUID | FK to dockets (unique) |
| definitionId | UUID | FK to workflow_definitions |
| currentState | VARCHAR(50) | Current state |
| stateData | JSONB | State-specific data |
| startedAt | TIMESTAMP | Workflow start |
| completedAt | TIMESTAMP | Workflow completion |

---

### WorkflowTransitions

Audit trail of state changes.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| instanceId | UUID | FK to workflow_instances |
| fromState | VARCHAR(50) | Previous state |
| toState | VARCHAR(50) | New state |
| action | VARCHAR(50) | Action performed |
| performedById | UUID | Who performed action |
| toUserId | UUID | New assignee (if applicable) |
| toDepartmentId | UUID | New department (if applicable) |
| notes | TEXT | Transition notes |
| reason | TEXT | Rejection/return reason |
| metadata | JSONB | Additional data |
| performedAt | TIMESTAMP | Transition timestamp |

---

## Notification Tables

### Notifications

In-app notifications for users.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| userId | UUID | FK to users |
| title | VARCHAR(255) | Notification title |
| message | TEXT | Notification body |
| resourceType | VARCHAR(50) | Related entity type |
| resourceId | UUID | Related entity ID |
| actionUrl | VARCHAR(500) | Click action URL |
| channels | JSONB | Delivery channels used |
| isRead | BOOLEAN | Read status |
| readAt | TIMESTAMP | When read |
| createdAt | TIMESTAMP | Creation timestamp |

---

### NotificationOutbox

Transactional outbox for reliable delivery.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| notificationId | UUID | FK to notifications |
| channel | ENUM | EMAIL, SMS, PUSH |
| payload | JSONB | Channel-specific data |
| status | ENUM | PENDING, SENT, FAILED |
| attempts | INTEGER | Retry count |
| lastAttemptAt | TIMESTAMP | Last attempt time |
| sentAt | TIMESTAMP | Successful send time |
| errorMessage | TEXT | Last error |
| createdAt | TIMESTAMP | Creation timestamp |

---

## Audit Tables

### AuditLogs

Comprehensive activity logging.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| userId | UUID | Acting user (nullable for system) |
| action | VARCHAR(100) | Action performed |
| resourceType | VARCHAR(50) | Entity type |
| resourceId | UUID | Entity ID |
| oldValues | JSONB | Previous state |
| newValues | JSONB | New state |
| ipAddress | VARCHAR(45) | Client IP |
| userAgent | TEXT | Client user agent |
| metadata | JSONB | Additional context |
| createdAt | TIMESTAMP | Log timestamp |

**Index:**
- `idx_audit_resource` - Composite on (resourceType, resourceId)
- `idx_audit_user` - For user activity queries
- `idx_audit_created` - For time-based queries

---

## Physical Register Tables

### PhysicalRegisters

Configurable physical logbooks.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| name | VARCHAR(100) | Register name |
| code | VARCHAR(20) | Short code |
| departmentId | UUID | Owning department |
| description | TEXT | Description |
| fields | JSONB | Custom field schema |
| isActive | BOOLEAN | Active status |
| createdAt | TIMESTAMP | Creation timestamp |
| updatedAt | TIMESTAMP | Last update timestamp |

---

### RegisterEntries

Individual register entries.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| registerId | UUID | FK to physical_registers |
| entryNumber | VARCHAR(50) | Auto-generated entry number |
| entryDate | DATE | Entry date |
| data | JSONB | Field values |
| docketId | UUID | Linked docket (optional) |
| createdById | UUID | Entry creator |
| createdAt | TIMESTAMP | Creation timestamp |
| updatedAt | TIMESTAMP | Last update timestamp |

---

## Session Management

### RefreshTokens

Stores refresh tokens for JWT rotation.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| userId | UUID | FK to users |
| token | VARCHAR(255) | Refresh token value |
| expiresAt | TIMESTAMP | Expiration time |
| revokedAt | TIMESTAMP | Revocation time |
| createdAt | TIMESTAMP | Creation timestamp |
| userAgent | TEXT | Client user agent |
| ipAddress | VARCHAR(45) | Client IP |

---

## Seeding

Default data is seeded via:

```bash
cd packages/database
npx prisma db seed
```

**Seed Data Includes:**
- Default admin user (admin@docqr.local / admin123)
- System roles (admin, clerk, recipient, approver)
- Default departments (Administration, Records)
- Sample docket types (Correspondence, Contract, Report)

---

## Backup & Recovery

### Backup

```bash
# Full backup
pg_dump -h localhost -U docqr -d docqr -F c -f backup.dump

# Schema only
pg_dump -h localhost -U docqr -d docqr --schema-only -f schema.sql
```

### Restore

```bash
pg_restore -h localhost -U docqr -d docqr -c backup.dump
```

---

## Performance Tips

1. **Connection Pooling**: Prisma uses connection pooling by default
2. **Query Optimization**: Use `include` sparingly, prefer `select`
3. **Pagination**: Always paginate list queries
4. **Indexes**: Add indexes for frequently filtered columns
5. **EXPLAIN ANALYZE**: Profile slow queries

```sql
EXPLAIN ANALYZE SELECT * FROM dockets WHERE status = 'open';
```

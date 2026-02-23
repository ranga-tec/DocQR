# DOCQR v2 - Module Documentation

## Overview

The backend is organized into NestJS modules following Domain-Driven Design principles. Each module is self-contained with its own controllers, services, DTOs, and guards.

```
apps/core/src/modules/
├── auth/           # Authentication & JWT
├── users/          # User management
├── roles/          # RBAC role management
├── departments/    # Department hierarchy
├── dockets/        # Core docket operations
├── workflow/       # State machine engine
├── notifications/  # Multi-channel alerts
├── registers/      # Physical logbooks
├── admin/          # System administration
├── prisma/         # Database service
├── storage/        # File storage abstraction
└── health/         # Health checks
```

---

## Auth Module

**Location:** `apps/core/src/modules/auth/`

Handles user authentication using JWT with refresh tokens.

### Files

| File | Purpose |
|------|---------|
| auth.module.ts | Module definition |
| auth.controller.ts | HTTP endpoints |
| auth.service.ts | Authentication logic |
| jwt.strategy.ts | Passport JWT strategy |
| jwt-auth.guard.ts | Route protection |
| dto/login.dto.ts | Login request validation |
| dto/register.dto.ts | Registration validation |

### Key Methods

```typescript
// AuthService
login(email: string, password: string): Promise<TokenResponse>
register(dto: RegisterDto): Promise<TokenResponse>
refresh(refreshToken: string): Promise<TokenResponse>
logout(userId: string, token: string): Promise<void>
validateUser(payload: JwtPayload): Promise<User>
```

### Token Structure

```typescript
// Access Token Payload
interface JwtPayload {
  sub: string;        // User ID
  email: string;
  roles: string[];
  permissions: string[];
  iat: number;
  exp: number;
}
```

### Configuration

| Env Variable | Default | Description |
|-------------|---------|-------------|
| JWT_SECRET | (required) | Access token signing key |
| JWT_EXPIRES_IN | 1d | Access token expiry |
| JWT_REFRESH_SECRET | (required) | Refresh token signing key |
| JWT_REFRESH_EXPIRES_IN | 7d | Refresh token expiry |

---

## Users Module

**Location:** `apps/core/src/modules/users/`

Manages user accounts, profiles, and role assignments.

### Files

| File | Purpose |
|------|---------|
| users.module.ts | Module definition |
| users.controller.ts | User CRUD endpoints |
| users.service.ts | User business logic |
| dto/create-user.dto.ts | User creation validation |
| dto/update-user.dto.ts | User update validation |

### Key Methods

```typescript
// UsersService
create(dto: CreateUserDto): Promise<User>
findAll(query: UserQueryDto): Promise<PaginatedResult<User>>
findById(id: string): Promise<User>
findByEmail(email: string): Promise<User | null>
update(id: string, dto: UpdateUserDto): Promise<User>
delete(id: string): Promise<void>
assignRole(userId: string, roleId: string): Promise<void>
removeRole(userId: string, roleId: string): Promise<void>
assignDepartment(userId: string, deptId: string, isPrimary: boolean): Promise<void>
```

### Permissions Required

| Endpoint | Permission |
|----------|------------|
| GET /users | user:list |
| POST /users | user:create |
| PUT /users/:id | user:update |
| DELETE /users/:id | user:delete |
| POST /users/:id/roles | user:manage-roles |

---

## Roles Module

**Location:** `apps/core/src/modules/roles/`

Manages RBAC roles and permissions.

### Key Methods

```typescript
// RolesService
create(dto: CreateRoleDto): Promise<Role>
findAll(): Promise<Role[]>
findById(id: string): Promise<Role>
update(id: string, dto: UpdateRoleDto): Promise<Role>
delete(id: string): Promise<void>
getAllPermissions(): string[]
```

### System Roles

These cannot be deleted:

| Role | Description | Key Permissions |
|------|-------------|-----------------|
| admin | Full system access | * (all) |
| clerk | Document intake | docket:create, attachment:upload |
| recipient | Document handling | docket:view, docket:comment |
| approver | Decision making | docket:approve, docket:reject |

### Permission Format

```
resource:action

Examples:
- docket:create
- docket:view
- docket:update
- docket:delete
- docket:forward
- docket:approve
- docket:reject
- attachment:upload
- attachment:view
- attachment:delete
- user:create
- user:manage-roles
- admin:dashboard
- admin:audit-logs
```

---

## Departments Module

**Location:** `apps/core/src/modules/departments/`

Manages organizational hierarchy.

### Key Methods

```typescript
// DepartmentsService
create(dto: CreateDepartmentDto): Promise<Department>
findAll(): Promise<Department[]>
findById(id: string): Promise<Department>
getHierarchy(): Promise<DepartmentNode[]>  // Tree structure
getUsers(id: string): Promise<User[]>
update(id: string, dto: UpdateDepartmentDto): Promise<Department>
delete(id: string): Promise<void>
```

### Hierarchy Structure

```typescript
interface DepartmentNode {
  id: string;
  name: string;
  code: string;
  children: DepartmentNode[];
  head?: User;
}
```

---

## Dockets Module

**Location:** `apps/core/src/modules/dockets/`

Core module for docket management.

### Files

| File | Purpose |
|------|---------|
| dockets.module.ts | Module definition |
| dockets.controller.ts | Docket CRUD + workflow actions |
| dockets.service.ts | Docket business logic |
| attachments.controller.ts | File upload/download |
| attachments.service.ts | Attachment management |
| comments.controller.ts | Comment management |
| comments.service.ts | Comment logic |
| qrcode.service.ts | QR generation |
| dto/*.dto.ts | Request validation |

### Key Methods

```typescript
// DocketsService
create(dto: CreateDocketDto, userId: string): Promise<Docket>
findAll(query: DocketQueryDto, userId: string): Promise<PaginatedResult<Docket>>
findById(id: string): Promise<Docket>
findByQrToken(token: string): Promise<Docket>
update(id: string, dto: UpdateDocketDto): Promise<Docket>
delete(id: string): Promise<void>
getStats(userId: string): Promise<DocketStats>
regenerateQrToken(id: string): Promise<string>

// AttachmentsService
upload(docketId: string, file: Express.Multer.File, userId: string): Promise<Attachment>
findByDocket(docketId: string): Promise<Attachment[]>
getDownloadUrl(id: string): Promise<string>
delete(id: string): Promise<void>

// CommentsService
create(docketId: string, dto: CreateCommentDto, userId: string): Promise<Comment>
findByDocket(docketId: string): Promise<Comment[]>
```

### Docket Number Format

```
{PREFIX}/{YEAR}/{SEQUENCE}

Examples:
- DOC/2024/000001
- CONTRACT/2024/000015
- MEMO/2024/000003
```

Auto-generated based on docket type prefix.

---

## Workflow Module

**Location:** `apps/core/src/modules/workflow/`

State machine engine for docket workflows.

### Files

| File | Purpose |
|------|---------|
| workflow.module.ts | Module definition |
| workflow.service.ts | State transitions |
| workflow.constants.ts | State/action definitions |

### Key Methods

```typescript
// WorkflowService
forward(docketId: string, dto: ForwardDto, userId: string): Promise<void>
approve(docketId: string, dto: ApproveDto, userId: string): Promise<void>
reject(docketId: string, dto: RejectDto, userId: string): Promise<void>
close(docketId: string, userId: string): Promise<void>
reopen(docketId: string, userId: string): Promise<void>
archive(docketId: string, userId: string): Promise<void>
getHistory(docketId: string): Promise<WorkflowTransition[]>
getAllowedActions(docketId: string, userId: string): Promise<string[]>
```

### State Transitions

```typescript
const TRANSITIONS: Record<DocketStatus, Record<string, DocketStatus>> = {
  OPEN: {
    forward: 'FORWARDED',
    start_review: 'IN_REVIEW',
    close: 'CLOSED',
  },
  IN_REVIEW: {
    forward: 'FORWARDED',
    submit: 'PENDING_APPROVAL',
    close: 'CLOSED',
  },
  FORWARDED: {
    accept: 'IN_REVIEW',
    forward: 'FORWARDED',
    return: 'IN_REVIEW',
  },
  PENDING_APPROVAL: {
    approve: 'APPROVED',
    reject: 'REJECTED',
    return: 'IN_REVIEW',
  },
  APPROVED: {
    close: 'CLOSED',
    forward: 'FORWARDED',
  },
  REJECTED: {
    reopen: 'OPEN',
    close: 'CLOSED',
  },
  CLOSED: {
    reopen: 'OPEN',
    archive: 'ARCHIVED',
  },
  ARCHIVED: {
    // Terminal state - no transitions
  },
};
```

---

## Notifications Module

**Location:** `apps/core/src/modules/notifications/`

Multi-channel notification delivery.

### Files

| File | Purpose |
|------|---------|
| notifications.module.ts | Module definition |
| notifications.service.ts | Core notification logic |
| notifications.controller.ts | User notification endpoints |
| notifications.processor.ts | BullMQ job processor |
| providers/email.service.ts | SendGrid integration |
| providers/sms.service.ts | Twilio integration |

### Key Methods

```typescript
// NotificationsService
queueNotification(payload: NotificationPayload): Promise<void>
sendNotification(payload: NotificationPayload): Promise<void>
getUserNotifications(userId: string, options: QueryOptions): Promise<PaginatedResult<Notification>>
markAsRead(notificationId: string, userId: string): Promise<void>
markAllAsRead(userId: string): Promise<void>
getUnreadCount(userId: string): Promise<number>
```

### Notification Types

```typescript
enum NotificationType {
  DOCKET_CREATED = 'DOCKET_CREATED',
  DOCKET_FORWARDED = 'DOCKET_FORWARDED',
  DOCKET_APPROVED = 'DOCKET_APPROVED',
  DOCKET_REJECTED = 'DOCKET_REJECTED',
  DOCKET_CLOSED = 'DOCKET_CLOSED',
  DOCKET_COMMENT = 'DOCKET_COMMENT',
  DOCKET_ATTACHMENT = 'DOCKET_ATTACHMENT',
  SLA_WARNING = 'SLA_WARNING',
  SLA_BREACH = 'SLA_BREACH',
}
```

### Channels

| Channel | Provider | Configuration |
|---------|----------|---------------|
| EMAIL | SendGrid | SENDGRID_API_KEY |
| SMS | Twilio | TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN |
| IN_APP | Database | N/A |

---

## Registers Module

**Location:** `apps/core/src/modules/registers/`

Physical logbook management.

### Key Methods

```typescript
// RegistersService
createRegister(dto: CreateRegisterDto): Promise<Register>
findAllRegisters(deptId?: string): Promise<Register[]>
createEntry(registerId: string, dto: CreateEntryDto, userId: string): Promise<RegisterEntry>
findEntries(registerId: string, query: EntryQueryDto): Promise<PaginatedResult<Entry>>
linkToDocket(entryId: string, docketId: string): Promise<void>
```

### Custom Fields Schema

```typescript
// Register field definition
interface FieldDefinition {
  name: string;
  type: 'text' | 'number' | 'date' | 'select' | 'user';
  required: boolean;
  options?: string[];  // For select type
}

// Example register
{
  name: "Incoming Mail",
  code: "MAIL-IN",
  fields: [
    { name: "sender", type: "text", required: true },
    { name: "receivedDate", type: "date", required: true },
    { name: "receivedBy", type: "user", required: true },
    { name: "category", type: "select", required: false, options: ["Letter", "Package", "Legal"] }
  ]
}
```

---

## Admin Module

**Location:** `apps/core/src/modules/admin/`

System administration features.

### Key Methods

```typescript
// AdminService
getDashboardStats(): Promise<DashboardStats>
getAuditLogs(query: AuditQueryDto): Promise<PaginatedResult<AuditLog>>
getSystemHealth(): Promise<HealthStatus>
getSlaBreach(): Promise<Docket[]>
generateReport(type: ReportType, params: ReportParams): Promise<ReportResult>
```

### Dashboard Stats

```typescript
interface DashboardStats {
  totalDockets: number;
  openDockets: number;
  pendingApproval: number;
  closedThisMonth: number;
  slaBreaches: number;
  byStatus: Record<DocketStatus, number>;
  byDepartment: Array<{ name: string; count: number }>;
  byPriority: Record<Priority, number>;
  trend: Array<{ date: string; created: number; closed: number }>;
}
```

---

## Storage Module

**Location:** `apps/core/src/modules/storage/`

Abstraction layer for file storage.

### Key Methods

```typescript
// StorageService
upload(file: Buffer, key: string, mimeType: string): Promise<string>
download(key: string): Promise<Buffer>
getUrl(key: string, expiresIn?: number): Promise<string>
delete(key: string): Promise<void>
exists(key: string): Promise<boolean>
```

### Storage Backends

| Backend | Use Case | Configuration |
|---------|----------|---------------|
| Local | Development | USE_LOCAL_STORAGE=true |
| MinIO | Production (self-hosted) | MINIO_* variables |
| S3 | Production (AWS) | AWS_* variables |

---

## Prisma Module

**Location:** `apps/core/src/modules/prisma/`

Database connection wrapper.

### Usage

```typescript
// Inject in any service
constructor(private readonly prisma: PrismaService) {}

// Use Prisma client
const docket = await this.prisma.docket.findUnique({
  where: { id },
  include: { attachments: true },
});
```

### Connection Management

```typescript
// On module init
await this.prisma.$connect();

// On app shutdown
await this.prisma.$disconnect();
```

---

## Health Module

**Location:** `apps/core/src/modules/health/`

Health check endpoints for monitoring.

### Endpoints

| Endpoint | Description |
|----------|-------------|
| GET /health | Basic liveness check |
| GET /health/ready | Readiness (includes DB check) |

### Response

```json
{
  "status": "ok",
  "checks": {
    "database": "healthy",
    "redis": "healthy",
    "storage": "healthy"
  },
  "uptime": 3600,
  "timestamp": "2024-02-23T10:00:00Z"
}
```

---

## Adding a New Module

1. **Create module folder:**
   ```bash
   mkdir apps/core/src/modules/new-module
   ```

2. **Create module files:**
   ```
   new-module.module.ts
   new-module.controller.ts
   new-module.service.ts
   dto/create-new-module.dto.ts
   ```

3. **Define the module:**
   ```typescript
   @Module({
     imports: [PrismaModule],
     controllers: [NewModuleController],
     providers: [NewModuleService],
     exports: [NewModuleService],
   })
   export class NewModuleModule {}
   ```

4. **Register in app.module.ts:**
   ```typescript
   imports: [
     // ...existing modules
     NewModuleModule,
   ],
   ```

5. **Add Prisma models (if needed):**
   - Update `packages/database/prisma/schema.prisma`
   - Run `npx prisma migrate dev --name add_new_module`

6. **Add permissions (if needed):**
   - Update `RolesService.getAllPermissions()`
   - Add to seed data for default roles

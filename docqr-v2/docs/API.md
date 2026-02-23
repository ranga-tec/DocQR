# DOCQR v2 - API Documentation

## Base URL

```
Development: http://localhost:3000/api/v1
Production:  https://your-domain.com/api/v1
```

## Authentication

All protected endpoints require a Bearer token in the Authorization header:

```
Authorization: Bearer <access_token>
```

---

## Auth Endpoints

### POST /auth/register

Create a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "username": "johndoe",
  "password": "SecurePass123!",
  "firstName": "John",
  "lastName": "Doe",
  "phone": "+1234567890"
}
```

**Response (201):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "expiresIn": 86400,
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "username": "johndoe",
    "firstName": "John",
    "lastName": "Doe",
    "roles": ["recipient"],
    "permissions": ["docket:view", "docket:comment"]
  }
}
```

### POST /auth/login

Authenticate user and get tokens.

**Request Body:**
```json
{
  "email": "admin@docqr.local",
  "password": "admin123"
}
```

**Response (200):** Same as register response.

### POST /auth/refresh

Refresh access token using refresh token.

**Request Body:**
```json
{
  "refreshToken": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

### GET /auth/me

Get current user profile.

**Response (200):**
```json
{
  "id": "uuid",
  "email": "admin@docqr.local",
  "username": "admin",
  "firstName": "System",
  "lastName": "Administrator",
  "roles": ["admin"],
  "permissions": ["*"],
  "departments": [
    {
      "id": "uuid",
      "name": "Administration",
      "code": "ADMIN",
      "isPrimary": true
    }
  ]
}
```

---

## Docket Endpoints

### GET /dockets

List all dockets with filters.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| search | string | Search in docketNumber, subject, description |
| status | string/array | Filter by status(es) |
| priority | string/array | Filter by priority |
| docketTypeId | uuid | Filter by docket type |
| assigneeId | uuid | Filter by current assignee |
| departmentId | uuid | Filter by department |
| dateFrom | ISO date | Created after |
| dateTo | ISO date | Created before |
| slaStatus | string | on_track, at_risk, overdue |
| page | number | Page number (default: 1) |
| limit | number | Items per page (default: 20) |
| sortBy | string | Sort field (default: createdAt) |
| sortOrder | asc/desc | Sort direction (default: desc) |

**Response (200):**
```json
{
  "data": [
    {
      "id": "uuid",
      "docketNumber": "DOC/2024/000001",
      "subject": "Contract Review",
      "status": "open",
      "priority": "high",
      "docketType": {
        "id": "uuid",
        "name": "Contract",
        "code": "CONTRACT"
      },
      "currentAssignee": {
        "id": "uuid",
        "username": "johndoe"
      },
      "createdAt": "2024-02-23T10:00:00Z",
      "_count": {
        "attachments": 3,
        "comments": 5
      }
    }
  ],
  "meta": {
    "total": 100,
    "page": 1,
    "limit": 20,
    "totalPages": 5
  }
}
```

### POST /dockets

Create a new docket.

**Request Body:**
```json
{
  "subject": "Contract Review - ABC Corp",
  "description": "Annual service agreement for review",
  "docketTypeId": "uuid",
  "priority": "high",
  "confidentiality": "confidential",
  "assignToUserId": "uuid",
  "assignToDepartmentId": "uuid",
  "dueDate": "2024-03-15T00:00:00Z",
  "tags": ["contract", "legal"],
  "customFields": {
    "clientName": "ABC Corp",
    "contractValue": 50000
  }
}
```

**Response (201):** Full docket object with all relations.

### GET /dockets/:id

Get docket by ID with all relations.

### PUT /dockets/:id

Update docket metadata.

### DELETE /dockets/:id

Soft delete docket.

---

## QR Code Endpoints

### GET /dockets/qr/:token

Lookup docket by QR token. Used when scanning QR codes.

**Response (200):**
```json
{
  "id": "uuid",
  "docketNumber": "DOC/2024/000001",
  "subject": "Contract Review",
  "status": "in_review",
  "attachments": [
    {
      "id": "uuid",
      "originalFileName": "contract.pdf",
      "isPrimary": true
    }
  ]
}
```

### GET /dockets/:id/qr

Download QR code as PNG image.

**Response:** Binary PNG file

### POST /dockets/:id/regenerate-qr

Generate a new QR token (invalidates old QR code).

**Response (200):**
```json
{
  "message": "QR code regenerated successfully",
  "token": "new-secure-token"
}
```

---

## Workflow Endpoints

### POST /dockets/:id/forward

Forward docket to user or department.

**Request Body:**
```json
{
  "toUserId": "uuid",
  "toDepartmentId": "uuid",
  "instructions": "Please review clause 5.2",
  "reason": "Requires legal review"
}
```

**Response (200):**
```json
{
  "success": true,
  "newStatus": "forwarded",
  "message": "Docket transitioned to forwarded"
}
```

### POST /dockets/:id/approve

Approve docket (requires approver role).

### POST /dockets/:id/reject

Reject docket (requires approver role).

**Request Body:**
```json
{
  "reason": "Missing required signatures",
  "notes": "Please obtain signatures from all parties"
}
```

### POST /dockets/:id/close

Close docket.

### POST /dockets/:id/reopen

Reopen closed or rejected docket.

### GET /dockets/:id/history

Get complete workflow history.

**Response (200):**
```json
[
  {
    "id": "uuid",
    "fromState": "open",
    "toState": "forwarded",
    "action": "forward",
    "performer": {
      "id": "uuid",
      "username": "admin"
    },
    "toUser": {
      "id": "uuid",
      "username": "johndoe"
    },
    "notes": "For initial review",
    "performedAt": "2024-02-23T10:30:00Z"
  }
]
```

### GET /dockets/:id/actions

Get allowed actions for current user on this docket.

**Response (200):**
```json
["forward", "approve", "reject", "close"]
```

---

## Attachment Endpoints

### GET /dockets/:docketId/attachments

List all attachments for a docket.

### POST /dockets/:docketId/attachments

Upload attachment (multipart/form-data).

**Request:**
```
Content-Type: multipart/form-data

file: <binary>
```

**Response (201):**
```json
{
  "id": "uuid",
  "fileName": "uuid/abc123.pdf",
  "originalFileName": "contract.pdf",
  "fileSize": "1048576",
  "mimeType": "application/pdf",
  "isPrimary": true,
  "uploadedAt": "2024-02-23T10:00:00Z"
}
```

### GET /dockets/:docketId/attachments/:id/download

Download attachment file.

### DELETE /dockets/:docketId/attachments/:id

Soft delete attachment.

---

## Comment Endpoints

### GET /dockets/:docketId/comments

List all comments for a docket.

**Response (200):**
```json
[
  {
    "id": "uuid",
    "content": "Clause 5.2 needs revision",
    "commentType": "observation",
    "isInternal": false,
    "author": {
      "id": "uuid",
      "username": "johndoe"
    },
    "createdAt": "2024-02-23T11:00:00Z"
  }
]
```

### POST /dockets/:docketId/comments

Add a comment (immutable - cannot be edited or deleted).

**Request Body:**
```json
{
  "content": "Approved pending minor revisions",
  "commentType": "decision",
  "attachmentId": "uuid",
  "isInternal": false
}
```

**Comment Types:**
- `note` - General note
- `observation` - Observation/finding
- `instruction` - Instructions for recipient
- `query` - Question/query
- `response` - Response to query
- `decision` - Decision/ruling
- `system` - System-generated

---

## User Management (Admin)

### GET /users

List all users (admin only).

### POST /users

Create user (admin only).

### PUT /users/:id

Update user (admin only).

### DELETE /users/:id

Soft delete user (admin only).

---

## Roles (Admin)

### GET /roles

List all roles.

### GET /roles/permissions

List all available permissions.

### POST /roles

Create custom role (admin only).

---

## Departments

### GET /departments

List all departments.

### GET /departments/hierarchy

Get department tree structure.

### GET /departments/:id/users

List users in department.

---

## Error Responses

### 400 Bad Request
```json
{
  "statusCode": 400,
  "message": ["email must be an email"],
  "error": "Bad Request"
}
```

### 401 Unauthorized
```json
{
  "statusCode": 401,
  "message": "Invalid or expired token",
  "error": "Unauthorized"
}
```

### 403 Forbidden
```json
{
  "statusCode": 403,
  "message": "Missing required permission(s): docket:approve",
  "error": "Forbidden"
}
```

### 404 Not Found
```json
{
  "statusCode": 404,
  "message": "Docket not found",
  "error": "Not Found"
}
```

---

## Rate Limiting

Default limits:
- 100 requests per 15 minutes per IP
- Headers returned:
  - `X-RateLimit-Limit`
  - `X-RateLimit-Remaining`
  - `X-RateLimit-Reset`

---

## Swagger/OpenAPI

Interactive API documentation is available at:

```
http://localhost:3000/api/docs
```

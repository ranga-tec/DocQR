# DOCQR Maintainer Guide (Source of Truth)

This document is the operational and engineering source of truth for the current DOCQR production stack.

If another document conflicts with this one, follow this file and verify against code before changing behavior.

## 1. Scope and Current Reality

DOCQR is a hybrid physical-to-digital workflow platform with:

- Docket lifecycle management (`OPEN`, `FORWARDED`, `IN_REVIEW`, `PENDING_APPROVAL`, `APPROVED`, `REJECTED`, `CLOSED`, `ARCHIVED`)
- File attachments with integrity hash tracking
- QR-based public lookup + authenticated full view
- Users / Roles / Departments / Docket Types / Registers / Notifications
- OnlyOffice integration hooks

Current production runtime:

- Backend: ASP.NET Core API (`apps/backend-dotnet/src/DocQR.Api`)
- Frontend: React + Vite (`apps/web`)
- Database: PostgreSQL on Railway
- Storage: local path in current deployment (`Storage__Provider=local`), MinIO-capable in code

Legacy/parallel code exists:

- `apps/core` (NestJS) is still in repo but not the current production backend.
- Older docs that describe NestJS-only architecture are historical unless explicitly updated.

## 2. Repository Map

Top-level areas used by active production stack:

- `apps/backend-dotnet/src/DocQR.Api`
- `apps/web`
- `packages/database/prisma` (SQL schema baseline + seed helpers)
- `docs` (operational docs)

Important backend folders:

- `Controllers/` HTTP endpoints
- `Services/` business logic (`AuthService`, `DocketService`, `StorageService`, `QrCodeService`)
- `Entities/` EF Core mapped entities
- `Data/AppDbContext.cs` model relationships and indices
- `Program.cs` service registration, middleware pipeline, CORS, auth, health routes

Important frontend folders:

- `src/lib/api.ts` axios client, interceptors, typed endpoint wrappers
- `src/context/AuthContext.tsx` auth/session state
- `src/pages/*` main screens
- `src/components/*` reusable UI and feature widgets

## 3. Backend Architecture (.NET)

## 3.1 Request Pipeline

`Program.cs` order is intentionally:

1. `UseRouting()`
2. `UseCors("AllowFrontend")`
3. `UseAuthentication()`
4. `UseAuthorization()`
5. `MapControllers()`

This order prevents frequent CORS and auth regressions.

## 3.2 Database Connection Handling

`Program.cs` now normalizes both connection string forms:

- key-value form: `Host=...;Port=...;Database=...`
- URL form: `postgresql://user:pass@host:5432/db?...`

Why this exists:

- Railway commonly injects DB URLs.
- Npgsql expects key-value format unless normalized first.
- Without normalization, auth/register and all DB-backed endpoints can fail with:
  - `System.ArgumentException: Format of the initialization string does not conform to specification starting at index 0`

Never remove this normalization unless all deployment environments are guaranteed to use key-value connection strings.

## 3.3 API Surface (Implemented)

Primary controllers currently implemented:

- `AuthController` -> `/api/v1/auth/*`
- `UsersController` -> `/api/v1/users/*`
- `RolesController` -> `/api/v1/roles/*`
- `DepartmentsController` -> `/api/v1/departments/*`
- `DocketsController` -> `/api/v1/dockets/*`
- `AttachmentsController` -> `/api/v1/dockets/{docketId}/attachments/*`
- `DocketTypesController` -> `/api/v1/docket-types/*`
- `RegistersController` -> `/api/v1/registers/*`
- `NotificationsController` -> `/api/v1/notifications/*`
- `OnlyOfficeController` -> `/api/v1/onlyoffice/*`
- `AdminController` -> `/api/v1/admin/*` (`stats`, `audit-logs`, `reports/sla`, `reports/workload`, `reports/turnaround`)

Also mapped:

- `GET /health`
- `GET /scan/{token}` (compat route for old QR links)

## 3.4 RBAC Model

- Users can have multiple roles (`user_roles`)
- Roles store permission arrays in JSONB
- Departments support hierarchy (`parent_id`)
- User-to-department assignment supports primary department

Permission enforcement is partially role-guarded by authenticated endpoints and role data; there is no full policy-engine middleware yet.

## 3.5 Workflow and Docket Behavior

Core behavior currently in `DocketService`:

- Docket number generation by type/year (fallback `DOC-YYYY-NNNNN`)
- QR token generation + expiry metadata
- Assignee tracking + assignment records on forward
- Current department resolution from the direct department target or the assignee's primary department
- Current progress summary derivation from docket status and latest assignment
- Soft-delete for dockets/attachments
- Basic comments and attachment lifecycle

State transitions are available via controller endpoints, but transition policy logic is not fully centralized in a declarative engine yet.

Current workflow visibility contract:

- `GET /api/v1/dockets` now returns enough metadata for list-level progress tracking:
  - external sender fields
  - current assignee
  - current department/location
  - latest assignment summary (`currentAssignment`)
  - derived `progressSummary`
- `POST /api/v1/dockets/{id}/forward` accepts:
  - `toUserId`
  - `toDepartmentId`
  - `instructions`
  - `comments`
- `GET /api/v1/dockets/{id}/history` now returns real assignment and acceptance events rather than a single placeholder event.

## 3.6 Scanner + OCR Status

Current implemented scanner path:

- `POST /api/v1/dockets/{docketId}/attachments/scan`
- Behavior: stores scanned file as normal attachment (same flow as upload)

Current OCR state:

- OCR extraction/persistence is **not** implemented in backend code yet.
- No dedicated persisted OCR text field is currently populated for attachments.

Recommended implementation extension:

1. Add fields (or table) for extracted text + metadata:
   - `ocr_text`, `ocr_status`, `ocr_engine`, `ocr_confidence`, `ocr_extracted_at`
2. Process OCR asynchronously after upload/scan
3. Keep source image/PDF immutable and version OCR output separately
4. Index extracted text (`GIN` with `tsvector`) for search

## 3.7 Digital Signature Status

- Frontend has placeholder API wrapper for signing endpoints.
- .NET backend does not yet expose `/api/v1/signing/*` routes.

Recommended production abstraction:

- `ISigningProvider` with provider adapters:
  - `SigNEXProvider`
  - `StellaSignProvider`
  - `NoOp/MockProvider` for non-production environments
- Persist request/signature state transitions in `signing_requests`/`signatures`

## 4. Frontend Architecture (React)

## 4.1 Routing

`src/App.tsx` defines:

- Public: `/login`, `/register`, `/qr/:token`
- Protected dashboard routes:
  - `/dashboard`
  - `/dockets`, `/dockets/new`, `/dockets/:id`
  - `/inbox`, `/scan`
  - `/users`, `/departments`, `/roles`, `/docket-types`
  - `/registers`, `/settings`, `/admin`
  - `/document/:attachmentId` (protected full-screen editor)

## 4.2 API Client

`src/lib/api.ts`:

- Uses `VITE_API_URL` if set
- Production fallback:
  - `https://docqr-api-production.up.railway.app/api/v1`
- Request interceptor adds `Authorization: Bearer <token>`
- 401 interceptor attempts refresh via `/auth/refresh`

## 4.3 API Drift Notes

Some frontend wrappers reference endpoints not implemented in .NET backend yet (currently mainly signing paths). When adding or removing endpoints, update both:

1. backend controller routes
2. `src/lib/api.ts` wrappers

and then run smoke tests for each affected page.

## 4.4 Docket UX Notes

Current docket UI behavior in `apps/web`:

- `pages/dockets/DocketDetail.tsx`
  - exposes both `QR Code` and `Print QR`
  - `Print QR` fetches the QR image and opens the browser print dialog without requiring the preview modal first
  - shows current department/location, sender chain, and progress summary
- `pages/dockets/DocketsList.tsx`
  - shows operational progress fields directly in the list card so users can tell:
    - where the docket is
    - who sent it
    - who is currently holding it
    - what action is currently expected

If these fields disappear from the UI, verify the backend docket DTO mapping before changing the frontend layout.

## 5. Database and Migration Strategy

## 5.1 Baseline

Baseline schema SQL lives at:

- `packages/database/prisma/migrations/20260223160405_init/migration.sql`

It contains full platform schema (users, dockets, workflow, notifications, signing, audit tables).

## 5.2 .NET Compatibility Patches

Production required extra columns for current .NET code paths:

- `dockets`: `qr_token_expires_at`, `qr_token_created_at`, `sender_name`, `sender_organization`, `sender_email`, `sender_phone`, `sender_address`, `received_date`
- `docket_attachments`: `file_hash`, `hash_algorithm`, `hash_verified_at`, `integrity_status`

Tracked SQL:

- `docs/sql/2026-03-02-dotnet-compatibility.sql`

Apply this after baseline schema in any new environment.

## 5.3 Seed Essentials

Minimum data required for stable auth/authorization behavior:

- Permissions catalog
- System roles (`admin`, `clerk`, `recipient`, `approver`)
- At least one admin user
- User-role assignment for admin

Without these, register/login/management flows can partially fail or degrade.

## 6. Deployment Model (Railway)

Current active services:

- `docqr-api` (backend)
- `docqr-web` (frontend)
- `Postgres`
- `Redis`

Stale services were removed from project on 2026-03-02.

Backend deploy source directory:

- `docqr-v2/apps/backend-dotnet/src/DocQR.Api`

Frontend deploy source directory:

- `docqr-v2/apps/web`

See `docs/PRODUCTION_RUNBOOK.md` for commands and post-deploy checks.

## 7. Change Playbooks for Future Agents

## 7.1 Add Backend Feature

1. Add/modify entity models + `AppDbContext` mapping/indexes
2. Add migration SQL (prefer idempotent safety in ops scripts)
3. Add service logic in `Services/*`
4. Add controller route(s) and DTO validation attributes
5. Update `apps/web/src/lib/api.ts`
6. Update UI pages/components
7. Run:
   - `dotnet build` (backend)
   - `npm run build --workspace=apps/web` (frontend)
8. Deploy and run smoke tests

## 7.2 Remove Feature

1. Remove frontend route/components usage first
2. Remove API wrapper calls
3. Remove backend routes/services
4. Only then remove DB columns/tables in a migration with explicit rollback plan
5. Verify no remaining references with `rg`

## 7.3 Modify Existing Feature

Follow compatibility-first approach:

1. Preserve response fields used by UI whenever possible
2. Add fields before deprecating old ones
3. If behavior changes, patch both API and UI in same release
4. Update this guide and runbook if operational behavior changes

## 8. Verification Checklist

Before marking a release as production-ready:

1. `dotnet build` succeeds in `apps/backend-dotnet/src/DocQR.Api`
2. `npm run build --workspace=apps/web` succeeds
3. API health returns 200
4. CORS preflight from web origin returns 204 + `Access-Control-Allow-Origin`
5. `/api/v1/auth/register` returns:
   - 201 on valid payload
   - 400 on invalid payload (not 500)
6. Login + protected page navigation works
7. Docket create/list/search/QR lookup works
8. Attachment upload/download works
9. Notifications unread-count endpoint resolves (401/200 expected based on auth state, not 404)

## 9. Known Gaps (Track Explicitly)

These are not fully implemented in current .NET backend and should not be assumed complete:

- OCR extraction and persistent per-document content indexing
- Signature provider endpoints and workflow execution
- Full declarative workflow engine parity with original requirements

When implementing any of the above, update this guide and add migration + test notes.

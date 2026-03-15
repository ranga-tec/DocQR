# DOCQR Production Runbook (Railway)

This runbook describes how to deploy, verify, and troubleshoot the active production stack.

## 1. Active Services

Current Railway project (production environment) should contain:

- `docqr-api`
- `docqr-web`
- `onlyoffice-nginx`
- `Postgres`
- `Redis`

Public domains:

- API: `https://docqr-api-production.up.railway.app`
- Web: `https://docqr-web-production.up.railway.app`
- OnlyOffice: `https://onlyoffice-nginx-production.up.railway.app`

## 2. Required Environment Variables

## 2.1 API (`docqr-api`)

Minimum required:

- `ConnectionStrings__DefaultConnection`
- `Jwt__Secret`
- `Jwt__Issuer`
- `Jwt__Audience`
- `Cors__Origins__0=https://docqr-web-production.up.railway.app`
- `Storage__Provider` (`local` or `minio`)

Optional/common:

- `Cors__Origins__1=http://localhost:5173`
- `OnlyOffice__JwtEnabled`
- `OnlyOffice__ServerUrl`
- `OnlyOffice__JwtSecret`
- `OnlyOffice__ExternalBackendUrl`

Notes:

- DB connection may be URL form (`postgresql://...`) or key-value form.
- Backend startup now normalizes URL form automatically.
- Read-only document viewing works without OnlyOffice (browser-native preview/download).
- Document editing still requires a reachable public `OnlyOffice__ServerUrl`.
- For containerized deployments, set `OnlyOffice__ExternalBackendUrl` to the public API URL so OnlyOffice callbacks and file fetches resolve correctly.
- Current production points to `https://onlyoffice-nginx-production.up.railway.app`.

## 2.2 Web (`docqr-web`)

Recommended:

- `VITE_API_URL=https://docqr-api-production.up.railway.app/api/v1`

Fallback exists in code, but explicit env var is preferred.

## 3. Deploy Commands

From repository root:

```powershell
# Deploy backend
railway up docqr-v2/apps/backend-dotnet/src/DocQR.Api --path-as-root --service docqr-api --environment production

# Deploy frontend
railway up docqr-v2/apps/web --path-as-root --service docqr-web --environment production
```

If `railway up` fails with file-lock indexing errors in service subdirectories, run from repo root using `--path-as-root` as above.

## 4. Post-Deploy Smoke Tests

Run after every deploy:

```powershell
# health
Invoke-WebRequest -Uri 'https://docqr-api-production.up.railway.app/health' -Method Get

# CORS preflight
Invoke-WebRequest -Uri 'https://docqr-api-production.up.railway.app/api/v1/auth/register' `
  -Method Options `
  -Headers @{
    Origin='https://docqr-web-production.up.railway.app'
    'Access-Control-Request-Method'='POST'
    'Access-Control-Request-Headers'='content-type'
  }
```

Expected:

- Health: `200`
- Preflight: `204` with `Access-Control-Allow-Origin: https://docqr-web-production.up.railway.app`

Functional check:

- Register a unique user via `/api/v1/auth/register` with payload including `username`.
- Expect `201` on valid payload.
- Verify admin routes exist (unauthenticated should be `401`, not `404`):
  - `/api/v1/admin/stats`
  - `/api/v1/admin/audit-logs?page=1&limit=20`
  - `/api/v1/admin/reports/sla`
  - `/api/v1/admin/reports/workload`
  - `/api/v1/admin/reports/turnaround`
- Verify docket detail QR actions:
  - open any docket detail page
  - confirm both `QR Code` and `Print QR` actions are visible
  - confirm `Print QR` opens the browser print dialog without requiring the preview modal first
- Verify docket list progress metadata:
  - open `/dockets`
  - confirm each populated card shows current holder, sender, location/department, and progress summary
  - forward a test docket with `instructions` and confirm the instruction appears in both list/detail views and history

## 5. Database Bootstrap / Repair

If deploying into a fresh or legacy DB:

1. Apply baseline schema:
   - `packages/database/prisma/migrations/20260223160405_init/migration.sql`
2. Apply .NET compatibility patch:
   - `docs/sql/2026-03-02-dotnet-compatibility.sql`
3. Ensure seed data exists:
   - permissions
   - roles (`admin`, `clerk`, `recipient`, `approver`)
   - at least one admin user + role assignment

## 6. Incident Playbook

## 6.1 Browser CORS Error + Register Fails

Symptom:

- Browser shows no `Access-Control-Allow-Origin` and `ERR_FAILED 500`.

Action:

1. Check API logs for backend exception first (CORS message is often secondary).
2. Verify DB connection string format and normalization.
3. Re-test preflight and POST register.

## 6.2 `Format of the initialization string does not conform...`

Cause:

- API received URL-style Postgres connection string and passed it raw to Npgsql.

Fix:

- Ensure backend contains normalized connection string logic in `Program.cs`.

## 6.3 `notifications/unread-count` returns 404

Cause:

- Old backend deployment or route mismatch.

Action:

1. Confirm current API deployment.
2. Verify route exists (`/api/v1/notifications/unread-count`).
3. Expected status when unauthenticated is `401`, not `404`.

## 6.4 Register returns 500 after migration

Likely causes:

- Missing role/permission seed data
- Legacy schema left behind
- Missing compatibility columns

Action:

1. Validate table structure against baseline + compatibility patch.
2. Validate required seed rows.

## 6.5 Admin endpoints return 404 in web console

Cause:

- API deployment is older than frontend contract (missing `AdminController` routes).

Action:

1. Deploy latest backend from `docqr-v2/apps/backend-dotnet/src/DocQR.Api`.
2. Re-test:
   - `GET /api/v1/admin/stats`
   - `GET /api/v1/admin/audit-logs?page=1&limit=20`
   - `GET /api/v1/admin/reports/sla`
3. Unauthenticated expected result is `401`; authenticated admin expected result is `200`.

## 6.6 Document view fails with `localhost:8080` in production

Cause:

- `OnlyOffice__ServerUrl` is pointing to localhost, which remote browsers cannot access.

Action:

1. For read-only access, use the normal View action (it now uses browser-native preview/download).
2. For editing, configure a public OnlyOffice server and set:
   - `OnlyOffice__ServerUrl=https://<public-onlyoffice-host>`
   - `OnlyOffice__ExternalBackendUrl=https://docqr-api-production.up.railway.app`

## 6.7 OnlyOffice on Railway (Hobby) - Known Good Setup

Use this exact pattern for Railway:

1. Create a dedicated service from `onlyoffice/documentserver:7.5.1` (or a tested pinned tag).
2. Create a Railway domain for that service.
3. Ensure the service domain target port is `8000`.
4. Configure shared JWT secret values in both services:
   - OnlyOffice service: `JWT_ENABLED=true`, `JWT_SECRET=<shared>`, `JWT_HEADER=Authorization`, `JWT_IN_BODY=true`
   - API service: `OnlyOffice__JwtEnabled=true`, `OnlyOffice__JwtSecret=<shared>`
5. Set API endpoint URLs:
   - `OnlyOffice__ServerUrl=https://onlyoffice-nginx-production.up.railway.app`
   - `OnlyOffice__ExternalBackendUrl=https://docqr-api-production.up.railway.app`

Validation checks:

- `GET https://onlyoffice-nginx-production.up.railway.app/healthcheck` -> `200` body `true`
- `GET https://onlyoffice-nginx-production.up.railway.app/web-apps/apps/api/documents/api.js` -> `200`
- `GET https://docqr-api-production.up.railway.app/health` -> `200`

If `targetPort` is null or wrong:

- Symptom: OnlyOffice domain returns `502 Bad Gateway` while deployment shows `SUCCESS`.
- Fix: update the service domain target port to `8000` (via Railway dashboard or Railway GraphQL `serviceDomainUpdate` mutation).

## 6.8 OnlyOffice comments list missing for view-only users

Symptom:

- In document viewer, left panel shows only PDF/bookmark outline and comment threads are not visible.

Cause:

- API config sent `review=false` / `customization.comments=false` for non-edit users, which hides comments UI even for read-only viewers.

Fix:

1. Deploy backend commit `bdbcff7` or newer.
2. Ensure OnlyOffice config for viewers uses:
   - `permissions.review=true`
   - `editorConfig.customization.comments=true`
   - keep `permissions.comment` permission-gated (write control)
3. Current web behavior (as of March 9, 2026):
   - `mode=view` for OnlyOffice-supported formats now opens OnlyOffice viewer (not browser PDF iframe), so comment threads are visible.
   - Add `&viewer=native` to the document URL to force browser-native preview when needed for troubleshooting.

## 6.9 OnlyOffice error: "The \"documentType\" parameter for the config object is invalid"

Symptom:

- Viewer fails to open and OnlyOffice returns: `"The \"documentType\" parameter for the config object is invalid."`

Cause:

- API sends unsupported `documentType` (for example `pdf`), but this deployment only accepts:
  - `word`
  - `cell`
  - `slide`

Fix:

1. Deploy backend commit `c0dd5e5` or newer.
2. Ensure PDF mapping returns:
   - `fileType: "pdf"`
   - `documentType: "word"`

## 7. Operations Notes

- Railway logs can be queried via CLI or GraphQL API.
- If CLI `railway logs` hangs/timeouts, use GraphQL `deploymentLogs` / `buildLogs` queries against `https://backboard.railway.app/graphql/v2`.
- Keep this runbook updated with every production incident fix and new env vars.

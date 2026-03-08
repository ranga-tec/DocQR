# DOCQR v2

Hybrid physical-to-digital document workflow platform centered on dockets, QR tracking, forwarding chains, and register management.

## Active Production Stack

- Backend: ASP.NET Core API (`apps/backend-dotnet/src/DocQR.Api`)
- Frontend: React + Vite (`apps/web`)
- Database: PostgreSQL
- Storage: local filesystem or MinIO (S3-compatible)
- Deployment: Railway

Legacy code (`apps/core`) remains in the repository for historical reasons but is not the current production backend.

## Quick Links

- Maintainer handbook: [docs/MAINTAIN_GUIDE.md](docs/MAINTAIN_GUIDE.md)
- Production runbook: [docs/PRODUCTION_RUNBOOK.md](docs/PRODUCTION_RUNBOOK.md)
- Documentation index: [docs/README.md](docs/README.md)

## Local Development

## Backend (.NET)

```powershell
cd apps/backend-dotnet/src/DocQR.Api
dotnet restore
dotnet run
```

Default API URL: `http://localhost:5000`

## Frontend

```powershell
cd apps/web
npm install
npm run dev
```

Default web URL: `http://localhost:5173`

Configure API target with:

- `VITE_API_URL=http://localhost:5000/api/v1`

## Build Checks

From repository root:

```powershell
dotnet build apps/backend-dotnet/src/DocQR.Api/DocQR.Api.csproj
npm run build --workspace=apps/web
```

## Production Domains

- Web: `https://docqr-web-production.up.railway.app`
- API: `https://docqr-api-production.up.railway.app`

## Notes

- Register payload must include `username`.
- Scanner endpoint exists at `/api/v1/dockets/{docketId}/attachments/scan`.
- Digital signature provider integration is still a placeholder path and should be completed with provider adapters.

## Recent Updates (2026-03-08)

- Workflow API parity on .NET backend:
  - Added `POST /api/v1/dockets/{id}/accept`
  - Added `POST /api/v1/dockets/{id}/close`
  - Aligned available actions to implemented endpoints to avoid UI 404s
- Role security hardening:
  - Frontend route guards now enforce permissions for `/users`, `/departments`, `/roles`, `/docket-types`, `/registers`, and `/admin`
  - Backend `RolesController` now enforces permission checks (read requires `admin:access` or `user:manage`; mutating role operations require `admin:access`)
- Recipient/view-only restrictions:
  - Commenting and reply UI are hidden for users without `docket:comment`
  - Server-side permission checks remain authoritative
- Notification UX:
  - Bell icon now opens a notification panel with recent items
  - Clicking a notification marks it read and opens its target docket (falls back to Inbox)

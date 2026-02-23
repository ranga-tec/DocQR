# DOCQR v2 - Technical Documentation

Welcome to the DOCQR v2 technical documentation. This documentation covers all aspects of the system for developers, administrators, and maintainers.

## Quick Links

### Architecture & Design
- [Architecture](ARCHITECTURE.md) - System architecture, design patterns, data flow, security model

### API Reference
- [API Documentation](API.md) - Complete REST API reference with request/response examples

### Database
- [Database Schema](DATABASE.md) - Tables, relationships, indexes, migration guide

### Backend
- [Module Documentation](MODULES.md) - Detailed documentation for each NestJS module

### Frontend
- [Frontend Guide](FRONTEND.md) - React application architecture, components, state management

### Operations
- [Deployment Guide](DEPLOYMENT.md) - Deploy to Railway, Docker, or bare metal
- [Configuration Reference](CONFIGURATION.md) - All environment variables explained

### Development
- [Development Guide](DEVELOPMENT.md) - Setup, workflow, testing, debugging

---

## System Overview

DOCQR v2 is a **Hybrid Physical-to-Digital Document Workflow System** that:

1. **Digitizes** incoming physical documents by scanning and uploading
2. **Tracks** physical documents via QR codes linked to digital records
3. **Routes** documents through configurable approval workflows
4. **Notifies** stakeholders via email, SMS, and in-app notifications
5. **Audits** all actions for compliance and accountability

### Key Concepts

| Concept | Description |
|---------|-------------|
| **Docket** | Primary container (folder) for a document matter |
| **Attachment** | Individual files within a docket |
| **Workflow** | State machine governing docket lifecycle |
| **QR Token** | Secure identifier linking physical to digital |
| **Assignment** | Forwarding chain showing document path |

### User Roles

| Role | Purpose |
|------|---------|
| **Admin** | Full system access, user management |
| **Clerk** | Create dockets, upload documents, manage registers |
| **Recipient** | Receive and process assigned dockets |
| **Approver** | Approve or reject dockets in approval workflow |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                 │
│                   React 19 + Vite + TailwindCSS                 │
└───────────────────────────┬─────────────────────────────────────┘
                            │ REST API
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                         BACKEND                                  │
│                   NestJS + Prisma + BullMQ                      │
│  ┌─────────┐ ┌─────────┐ ┌──────────┐ ┌────────────────────┐   │
│  │  Auth   │ │ Dockets │ │ Workflow │ │   Notifications    │   │
│  └─────────┘ └─────────┘ └──────────┘ └────────────────────┘   │
└───────────────────────────┬─────────────────────────────────────┘
                            │
         ┌──────────────────┼──────────────────┐
         ▼                  ▼                  ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│   PostgreSQL    │ │     MinIO       │ │     Redis       │
│   (Database)    │ │   (Storage)     │ │  (Cache/Queue)  │
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

---

## Getting Help

- **Issues**: [GitHub Issues](https://github.com/ranga-tec/DocQR/issues)
- **Discussions**: [GitHub Discussions](https://github.com/ranga-tec/DocQR/discussions)

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

See [DEVELOPMENT.md](DEVELOPMENT.md) for detailed contribution guidelines.

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 2.0.0 | Feb 2024 | Complete rebuild with NestJS, workflow engine, RBAC |
| 1.0.0 | - | Initial prototype |

---
description: Setup DOCQR project infrastructure
---

# DOCQR Project Setup Workflow

## 1. Initialize Project Structure
Create the following directory structure:
```
DOCQR/
├── backend/
│   ├── src/
│   │   ├── controllers/
│   │   ├── models/
│   │   ├── services/
│   │   ├── middleware/
│   │   ├── config/
│   │   ├── utils/
│   │   └── routes/
│   ├── uploads/
│   └── package.json
├── frontend/
│   ├── public/
│   └── src/
│       ├── components/
│       ├── pages/
│       ├── services/
│       ├── utils/
│       └── styles/
├── docker/
│   └── docker-compose.yml
└── README.md
```

## 2. Initialize Backend (Node.js + Express + TypeScript)
// turbo
```bash
cd backend
npm init -y
npm install express pg minio qrcode multer bcryptjs jsonwebtoken express-validator cors dotenv
npm install -D typescript @types/node @types/express @types/multer @types/bcryptjs @types/jsonwebtoken ts-node nodemon
npx tsc --init
```

## 3. Initialize Frontend (React + Vite + TypeScript)
// turbo
```bash
npx create-vite@latest frontend -- --template react-ts
cd frontend
npm install
npm install axios react-router-dom react-hook-form @tanstack/react-query zustand
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

## 4. Setup Docker Infrastructure
Create docker-compose.yml with PostgreSQL and MinIO services

## 5. Database Setup
Run PostgreSQL migrations to create tables

## 6. Start Development Servers
Start backend, frontend, and Docker services

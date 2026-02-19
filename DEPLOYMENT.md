# Deploying DOCQR to Railway

This guide assumes you have a Railway account connected to your GitHub account (`ranga-tec`).

## 1. Push Code to GitHub

First, you need to push this local code to a new GitHub repository.

1.  **Create a new repository** on GitHub named `DOCQR`.
2.  **Push your code**:
    ```bash
    git remote add origin https://github.com/ranga-tec/DOCQR.git
    git branch -M main
    git push -u origin main
    ```

## 2. Deploy on Railway

1.  **New Project**: Go to [Railway Dashboard](https://railway.app/dashboard) and click "New Project" > "Deploy from GitHub repo".
2.  **Select Repository**: Choose `ranga-tec/DOCQR`.
3.  **Add Database (Postgres)**:
    -   Right-click on the canvas > New Service > Database > PostgreSQL.
    -   Click on the PostgreSQL service card > Variables.
    -   Copy the connection values (Host, Database, User, Password, Port).
4.  **Add MinIO (Object Storage)**:
    -   Since Railway doesn't have a native MinIO plugin, you have two options:
        -   **Option A (Recommended for Prod)**: Use an S3 compatible service (like AWS S3, Cloudflare R2) and set variables accordingly.
        -   **Option B (Simple/Dev)**: Deploy MinIO as a Docker service on Railway.
            -   New Service > Docker Image.
            -   Image: `minio/minio`.
            -   Command: `server /data --console-address ":9001"`.
            -   Variables: `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD`.
            -   Volume: Add a volume mounted at `/data`.
5.  **Configure Environment Variables** for `DOCQR` service:
    -   Click on the `DOCQR` service card > Variables.
    -   Add the following:
        ```env
        NODE_ENV=production
        PORT=2000
        API_PREFIX=/api
        
        # Database (Use values from Postgres service)
        DB_HOST=${{PostgreSQL.PGHOST}}
        DB_PORT=${{PostgreSQL.PGPORT}}
        DB_USER=${{PostgreSQL.PGUSER}}
        DB_PASSWORD=${{PostgreSQL.PGPASSWORD}}
        DB_NAME=${{PostgreSQL.PGDATABASE}}
        
        # MinIO (Update with your MinIO/S3 details)
        MINIO_ENDPOINT=minio.railway.internal  # Internal host if using MinIO service
        MINIO_PORT=9000
        MINIO_ACCESS_KEY=minioadmin
        MINIO_SECRET_KEY=minioadmin123
        MINIO_BUCKET_DOCUMENTS=documents
        MINIO_BUCKET_QR_CODES=qr-codes
        
        # App URL (Update after deployment)
        APP_BASE_URL=https://<your-railway-app-url>.up.railway.app
        
        # Security
        JWT_SECRET=generate-a-long-random-string
        CORS_ORIGIN=https://<your-railway-app-url>.up.railway.app
        ```

6.  **Deploy**: Railway will automatically detect the `Dockerfile` and build your application.

## 3. Important Notes
-   The application serves both Frontend and Backend on the same port (2000).
-   After deployment, update `APP_BASE_URL` and `CORS_ORIGIN` variables with the actual public URL provided by Railway.

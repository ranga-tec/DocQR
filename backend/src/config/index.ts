import dotenv from 'dotenv';

dotenv.config();

export const config = {
    env: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '3000', 10),
    apiPrefix: process.env.API_PREFIX || '/api',

    database: {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432', 10),
        database: process.env.DB_NAME || 'docqr_db',
        user: process.env.DB_USER || 'docqr_user',
        password: process.env.DB_PASSWORD || 'docqr_password',
        max: parseInt(process.env.DB_MAX_CONNECTIONS || '20', 10),
    },

    minio: {
        endPoint: process.env.MINIO_ENDPOINT || 'localhost',
        port: parseInt(process.env.MINIO_PORT || (process.env.MINIO_ENDPOINT?.startsWith('https') ? '443' : '9000'), 10),
        useSSL: process.env.MINIO_USE_SSL === 'true',
        accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
        secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin123',
        buckets: {
            documents: process.env.MINIO_BUCKET_DOCUMENTS || 'documents',
            qrCodes: process.env.MINIO_BUCKET_QR_CODES || 'qr-codes',
        },
    },

    redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD || undefined,
        db: parseInt(process.env.REDIS_DB || '0', 10),
    },

    jwt: {
        secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key',
        expiresIn: process.env.JWT_EXPIRES_IN || '7d',
        refreshSecret: process.env.JWT_REFRESH_SECRET || 'your-super-secret-refresh-key',
        refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
    },

    upload: {
        maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '52428800', 10), // 50MB
        allowedFileTypes: (process.env.ALLOWED_FILE_TYPES || 'pdf,doc,docx,xls,xlsx,ppt,pptx,jpg,jpeg,png,gif,txt,csv').split(','),
    },

    qrCode: {
        size: parseInt(process.env.QR_CODE_SIZE || '300', 10),
        errorCorrectionLevel: (process.env.QR_CODE_ERROR_CORRECTION || 'M') as 'L' | 'M' | 'Q' | 'H',
        appBaseUrl: process.env.APP_BASE_URL || 'http://localhost:5173',
    },

    rateLimit: {
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
        max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
    },

    cors: {
        origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    },

    logging: {
        level: process.env.LOG_LEVEL || 'info',
        file: process.env.LOG_FILE || 'logs/app.log',
    },
};

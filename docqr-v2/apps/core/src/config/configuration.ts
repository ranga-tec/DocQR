export default () => ({
  // Server
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  apiPrefix: process.env.API_PREFIX || '/api',

  // Railway detection
  isRailway: !!process.env.RAILWAY_ENVIRONMENT,
  trustProxy: process.env.TRUST_PROXY === 'true' || !!process.env.RAILWAY_ENVIRONMENT,

  // Database
  database: {
    url: process.env.DATABASE_URL,
  },

  // Redis
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    url: process.env.REDIS_URL,
  },

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-change-in-production',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  // Storage
  storage: {
    useLocal: process.env.USE_LOCAL_STORAGE === 'true',
    useMinio: process.env.USE_MINIO === 'true',
    uploadsDir: process.env.UPLOADS_DIR || './uploads',
    minio: {
      endpoint: process.env.MINIO_ENDPOINT || 'localhost',
      port: parseInt(process.env.MINIO_PORT || '9000', 10),
      useSSL: process.env.MINIO_USE_SSL === 'true',
      accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
      secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
      buckets: {
        documents: process.env.MINIO_BUCKET_DOCUMENTS || 'documents',
        qrCodes: process.env.MINIO_BUCKET_QRCODES || 'qr-codes',
      },
    },
  },

  // File Upload
  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '52428800', 10), // 50MB default
    allowedMimeTypes: (process.env.ALLOWED_MIME_TYPES ||
      'application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,' +
      'application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,' +
      'image/jpeg,image/png,image/gif,image/webp'
    ).split(','),
  },

  // QR Code
  qrCode: {
    size: parseInt(process.env.QR_CODE_SIZE || '300', 10),
    errorCorrection: process.env.QR_CODE_ERROR_CORRECTION || 'M',
    baseUrl: process.env.APP_BASE_URL || 'http://localhost:3000',
  },

  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  },

  // CORS
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
  },

  // Email (SendGrid)
  email: {
    provider: 'sendgrid',
    sendgridApiKey: process.env.SENDGRID_API_KEY,
    fromEmail: process.env.EMAIL_FROM || 'noreply@docqr.local',
    fromName: process.env.EMAIL_FROM_NAME || 'DOCQR System',
  },

  // SMS (Twilio)
  sms: {
    provider: 'twilio',
    twilioAccountSid: process.env.TWILIO_ACCOUNT_SID,
    twilioAuthToken: process.env.TWILIO_AUTH_TOKEN,
    twilioFromNumber: process.env.TWILIO_FROM_NUMBER,
  },

  // OnlyOffice
  onlyOffice: {
    serverUrl: process.env.ONLYOFFICE_URL || 'http://localhost:8080',
    jwtSecret: process.env.ONLYOFFICE_JWT_SECRET || 'onlyoffice-secret',
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'debug',
  },
});

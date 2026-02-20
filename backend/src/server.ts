import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { config } from './config';
import { db } from './config/database';
import { storageClient, storageType } from './config/storage';
import { checkAndRepairSchema } from './utils/schema-repair';

// Import routes
import authRoutes from './routes/auth.routes';
import documentRoutes from './routes/document.routes';
import categoryRoutes from './routes/category.routes';
import adminRoutes from './routes/admin.routes';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger';

class Server {
    private app: Application;

    constructor() {
        this.app = express();
        this.initializeMiddlewares();
        this.initializeRoutes();
        this.initializeErrorHandling();
    }

    private initializeMiddlewares(): void {
        // Required behind Railway/load balancers for correct client IP handling.
        this.app.set('trust proxy', config.trustProxy);

        // Security
        this.app.use(helmet({
            contentSecurityPolicy: {
                useDefaults: true,
                directives: {
                    // Needed for QR scan from uploaded files (blob: object URLs in browser)
                    imgSrc: ["'self'", "data:", "blob:"],
                },
            },
        }));

        // CORS
        this.app.use(cors({
            origin: config.cors.origin,
            credentials: true,
        }));

        // Body parsing
        this.app.use(express.json());
        this.app.use(express.urlencoded({ extended: true }));

        // Compression
        this.app.use(compression());

        // Logging
        if (config.env === 'development') {
            this.app.use(morgan('dev'));
        } else {
            this.app.use(morgan('combined'));
        }

        // Rate limiting
        const limiter = rateLimit({
            windowMs: config.rateLimit.windowMs,
            max: config.rateLimit.max,
            message: 'Too many requests from this IP, please try again later.',
            standardHeaders: true,
            legacyHeaders: false,
        });
        this.app.use(limiter);
    }

    private initializeRoutes(): void {
        // Health check
        this.app.get('/health', (_req: Request, res: Response) => {
            res.status(200).json({
                status: 'OK',
                storage: storageType,
                minio: {
                    endpoint: config.minio.endPoint,
                    port: config.minio.port,
                    useSSL: config.minio.useSSL
                },
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
            });
        });

        // API root handler
        this.app.get(config.apiPrefix, (_req: Request, res: Response) => {
            res.json({ message: 'DOCQR API v1' });
        });

        // API Documentation
        this.app.use(
            `${config.apiPrefix}/docs`,
            swaggerUi.serve,
            swaggerUi.setup(swaggerSpec)
        );

        // API routes
        this.app.use(`${config.apiPrefix}/auth`, authRoutes);
        this.app.use(`${config.apiPrefix}/documents`, documentRoutes);
        this.app.use(`${config.apiPrefix}/categories`, categoryRoutes);
        this.app.use(`${config.apiPrefix}/admin`, adminRoutes);

        // Serve frontend static files (AFTER API routes)
        const path = require('path');
        const frontendPath = path.join(__dirname, '../../frontend/dist');
        this.app.use(express.static(frontendPath));

        // 404 handler for API routes
        this.app.use(`${config.apiPrefix}/*`, (_req: Request, res: Response) => {
            res.status(404).json({ error: 'Route not found' });
        });

        // Catch-all handler for SPA (serve index.html for non-API routes)
        this.app.get('*', (_req: Request, res: Response) => {
            res.sendFile(path.join(frontendPath, 'index.html'));
        });
    }

    private initializeErrorHandling(): void {
        this.app.use((err: Error, _req: Request, res: Response, next: NextFunction) => {
            console.error('Error:', err);

            if (res.headersSent) {
                return next(err);
            }

            res.status(500).json({
                error: config.env === 'development' ? err.message : 'Internal server error',
                ...(config.env === 'development' && { stack: err.stack }),
            });
        });
    }

    private async initializeDatabase(): Promise<void> {
        try {
            await db.query('SELECT NOW()');
            console.log('✓ Database connected successfully');

            // Auto-heal schema (fix missing columns)
            await checkAndRepairSchema();

        } catch (error) {
            console.error('✗ Database connection failed:', error);
            process.exit(1);
        }
    }

    private async initializeStorage(): Promise<void> {
        try {
            await storageClient.initializeBuckets();
            console.log('✓ Storage initialized successfully');
        } catch (error) {
            console.warn('⚠ Storage initialization failed (file uploads may not work):', (error as Error).message);
            // Non-fatal: app continues
        }
    }

    public async start(): Promise<void> {
        try {
            // Initialize database
            await this.initializeDatabase();

            // Initialize storage (MinIO or local)
            await this.initializeStorage();

            // Start server
            this.app.listen(config.port, () => {
                console.log('=================================');
                console.log(`🚀 DOCQR Server Started`);
                console.log(`📍 Environment: ${config.env}`);
                console.log(`🌐 Server: http://localhost:${config.port}`);
                console.log(`📡 API: http://localhost:${config.port}${config.apiPrefix}`);
                console.log(`🗄️  Database: ${config.database.host}:${config.database.port}`);
                console.log(`📦 Storage: ${storageType === 'local' ? 'Local Filesystem' : `MinIO (${config.minio.endPoint}:${config.minio.port})`}`);
                console.log('=================================');
            });
        } catch (error) {
            console.error('Failed to start server:', error);
            process.exit(1);
        }
    }

    public getApp(): Application {
        return this.app;
    }
}

// Start server
const server = new Server();
server.start();

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('SIGTERM signal received: closing HTTP server');
    await db.end();
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('SIGINT signal received: closing HTTP server');
    await db.end();
    process.exit(0);
});

export default server;

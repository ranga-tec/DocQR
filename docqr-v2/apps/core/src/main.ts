import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import compression from 'compression';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // Get configuration
  const port = configService.get<number>('port') || 3000;
  const apiPrefix = configService.get<string>('apiPrefix') || '/api';
  const trustProxy = configService.get<boolean>('trustProxy');
  const corsOrigin = configService.get<string>('cors.origin');

  // Trust proxy for Railway/load balancers
  if (trustProxy) {
    app.getHttpAdapter().getInstance().set('trust proxy', 1);
  }

  // Security middleware
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        scriptSrc: ["'self'"],
      },
    },
  }));

  // Compression
  app.use(compression());

  // CORS
  app.enableCors({
    origin: corsOrigin === '*' ? true : corsOrigin?.split(','),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  });

  // Global prefix
  app.setGlobalPrefix(apiPrefix);

  // API versioning
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Swagger documentation
  const swaggerConfig = new DocumentBuilder()
    .setTitle('DOCQR API')
    .setDescription('Hybrid Physical-to-Digital Document Workflow System API')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth',
    )
    .addTag('auth', 'Authentication endpoints')
    .addTag('users', 'User management')
    .addTag('roles', 'Role management')
    .addTag('departments', 'Department management')
    .addTag('dockets', 'Docket management')
    .addTag('attachments', 'Attachment management')
    .addTag('comments', 'Comment management')
    .addTag('workflow', 'Workflow engine')
    .addTag('notifications', 'Notification management')
    .addTag('registers', 'Physical register management')
    .addTag('admin', 'Administrative endpoints')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup(`${apiPrefix}/docs`, app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  // Health check endpoint
  app.getHttpAdapter().get('/health', (req, res) => {
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  await app.listen(port, '0.0.0.0');

  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                      DOCQR v2 Core Service                     ║
╠═══════════════════════════════════════════════════════════════╣
║  Environment:  ${configService.get<string>('nodeEnv')?.padEnd(46)}║
║  Port:         ${port.toString().padEnd(46)}║
║  API Prefix:   ${apiPrefix.padEnd(46)}║
║  Swagger:      ${(apiPrefix + '/docs').padEnd(46)}║
║  Health:       /health                                         ║
╚═══════════════════════════════════════════════════════════════╝
  `);
}

bootstrap();

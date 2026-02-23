import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { configuration } from './config';

// Core modules
import { PrismaModule } from './modules/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { RolesModule } from './modules/roles/roles.module';
import { DepartmentsModule } from './modules/departments/departments.module';
import { DocketsModule } from './modules/dockets/dockets.module';
// import { WorkflowModule } from './modules/workflow/workflow.module';
// import { NotificationsModule } from './modules/notifications/notifications.module';
// import { RegistersModule } from './modules/registers/registers.module';
// import { AdminModule } from './modules/admin/admin.module';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: ['.env.local', '.env'],
    }),

    // Rate limiting
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => [
        {
          ttl: configService.get<number>('rateLimit.windowMs') || 900000,
          limit: configService.get<number>('rateLimit.maxRequests') || 100,
        },
      ],
    }),

    // Core modules
    PrismaModule,
    AuthModule,
    UsersModule,
    RolesModule,
    DepartmentsModule,
    DocketsModule,
    // WorkflowModule,
    // NotificationsModule,
    // RegistersModule,
    // AdminModule,
  ],
})
export class AppModule {}

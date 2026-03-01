import { Module, forwardRef } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { memoryStorage } from 'multer';
import { DocketsController } from './dockets.controller';
import { DocketsService } from './dockets.service';
import { QrCodeService } from './qrcode.service';
import { StorageService } from './storage.service';
import { WorkflowService } from './workflow.service';
import { DocumentContentService } from './document-content.service';
import { CommentsController } from './comments.controller';
import { AttachmentsController } from './attachments.controller';
import { DocketTypesController } from './docket-types.controller';
import { DocketTypesService } from './docket-types.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    forwardRef(() => NotificationsModule),
    MulterModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        storage: memoryStorage(),
        limits: {
          fileSize: configService.get<number>('upload.maxFileSize') || 52428800, // 50MB default
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [DocketsController, CommentsController, AttachmentsController, DocketTypesController],
  providers: [DocketsService, QrCodeService, StorageService, WorkflowService, DocumentContentService, DocketTypesService],
  exports: [DocketsService, QrCodeService, StorageService, WorkflowService, DocumentContentService, DocketTypesService],
})
export class DocketsModule {}

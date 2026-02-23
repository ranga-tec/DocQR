import { Module } from '@nestjs/common';
import { DocketsController } from './dockets.controller';
import { DocketsService } from './dockets.service';
import { QrCodeService } from './qrcode.service';
import { StorageService } from './storage.service';
import { WorkflowService } from './workflow.service';
import { CommentsController } from './comments.controller';
import { AttachmentsController } from './attachments.controller';

@Module({
  controllers: [DocketsController, CommentsController, AttachmentsController],
  providers: [DocketsService, QrCodeService, StorageService, WorkflowService],
  exports: [DocketsService, QrCodeService, StorageService, WorkflowService],
})
export class DocketsModule {}

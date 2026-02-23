import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from './storage.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';

@ApiTags('attachments')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('dockets/:docketId/attachments')
export class AttachmentsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  @Get()
  @UseGuards(PermissionsGuard)
  @RequirePermissions('attachment:view')
  @ApiOperation({ summary: 'List all attachments for a docket' })
  async findAll(@Param('docketId') docketId: string) {
    return this.prisma.docketAttachment.findMany({
      where: { docketId, deletedAt: null },
      include: {
        uploader: { select: { id: true, username: true } },
      },
      orderBy: { uploadedAt: 'desc' },
    });
  }

  @Post()
  @UseGuards(PermissionsGuard)
  @RequirePermissions('attachment:upload')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload an attachment to docket' })
  async upload(
    @Param('docketId') docketId: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser('id') userId: string,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    // Verify docket exists
    const docket = await this.prisma.docket.findUnique({ where: { id: docketId } });
    if (!docket) {
      throw new BadRequestException('Docket not found');
    }

    // Generate storage key
    const ext = path.extname(file.originalname);
    const storageKey = `${docketId}/${uuidv4()}${ext}`;

    // Upload to storage
    await this.storageService.uploadFile(
      this.storageService.getDocumentsBucket(),
      storageKey,
      file.buffer,
      file.mimetype,
    );

    // Check if this is the first attachment (make it primary)
    const existingAttachments = await this.prisma.docketAttachment.count({
      where: { docketId, deletedAt: null },
    });

    // Create attachment record
    const attachment = await this.prisma.docketAttachment.create({
      data: {
        docketId,
        fileName: storageKey,
        originalFileName: file.originalname,
        fileSize: BigInt(file.size),
        mimeType: file.mimetype,
        storageBucket: this.storageService.getDocumentsBucket(),
        storageKey,
        isPrimary: existingAttachments === 0,
        uploadedBy: userId,
      },
    });

    return {
      ...attachment,
      fileSize: attachment.fileSize.toString(),
    };
  }

  @Get(':attachmentId')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('attachment:view')
  @ApiOperation({ summary: 'Get attachment details' })
  async findOne(
    @Param('docketId') docketId: string,
    @Param('attachmentId') attachmentId: string,
  ) {
    const attachment = await this.prisma.docketAttachment.findFirst({
      where: { id: attachmentId, docketId, deletedAt: null },
      include: {
        uploader: { select: { id: true, username: true } },
        lastEditor: { select: { id: true, username: true } },
      },
    });

    if (!attachment) {
      throw new BadRequestException('Attachment not found');
    }

    return {
      ...attachment,
      fileSize: attachment.fileSize.toString(),
    };
  }

  @Get(':attachmentId/download')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('attachment:download')
  @ApiOperation({ summary: 'Download attachment file' })
  async download(
    @Param('docketId') docketId: string,
    @Param('attachmentId') attachmentId: string,
    @Res() res: Response,
  ) {
    const attachment = await this.prisma.docketAttachment.findFirst({
      where: { id: attachmentId, docketId, deletedAt: null },
    });

    if (!attachment) {
      throw new BadRequestException('Attachment not found');
    }

    const stream = await this.storageService.getFile(
      attachment.storageBucket,
      attachment.storageKey,
    );

    res.set({
      'Content-Type': attachment.mimeType,
      'Content-Disposition': `attachment; filename="${attachment.originalFileName}"`,
    });

    stream.pipe(res);
  }

  @Delete(':attachmentId')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('attachment:upload')
  @ApiOperation({ summary: 'Delete attachment (soft delete)' })
  async remove(
    @Param('docketId') docketId: string,
    @Param('attachmentId') attachmentId: string,
  ) {
    const attachment = await this.prisma.docketAttachment.findFirst({
      where: { id: attachmentId, docketId, deletedAt: null },
    });

    if (!attachment) {
      throw new BadRequestException('Attachment not found');
    }

    await this.prisma.docketAttachment.update({
      where: { id: attachmentId },
      data: { deletedAt: new Date() },
    });

    return { message: 'Attachment deleted successfully' };
  }
}

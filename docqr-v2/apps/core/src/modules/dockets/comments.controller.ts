import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Logger,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { NotificationChannel, NotificationType, NotificationsService } from '../notifications/notifications.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { StorageService } from './storage.service';
import { DocumentContentService } from './document-content.service';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { ConfigService } from '@nestjs/config';

export interface CreateCommentDto {
  content: string;
  commentType?: string;
  attachmentId?: string;
  parentCommentId?: string;
  isInternal?: boolean;
}

@ApiTags('comments')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('dockets/:docketId/comments')
export class CommentsController {
  private readonly logger = new Logger(CommentsController.name);
  private readonly maxUploadFileSize: number;
  private readonly allowedMimeTypes: Set<string>;
  private readonly allowedExtensions = new Set([
    '.pdf',
    '.doc',
    '.docx',
    '.xls',
    '.xlsx',
    '.png',
    '.jpg',
    '.jpeg',
    '.gif',
    '.webp',
    '.tif',
    '.tiff',
  ]);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly storageService: StorageService,
    private readonly documentContentService: DocumentContentService,
    private readonly configService: ConfigService,
  ) {
    this.maxUploadFileSize = this.configService.get<number>('upload.maxFileSize') || (50 * 1024 * 1024);
    const allowed = this.configService.get<string[]>('upload.allowedMimeTypes') || [];
    this.allowedMimeTypes = new Set(allowed.map((value) => value.toLowerCase().trim()));
  }

  private validateAttachmentUpload(file: Express.Multer.File): void {
    if (!file?.buffer || file.size <= 0) {
      throw new BadRequestException('Uploaded file is empty or invalid');
    }

    if (file.size > this.maxUploadFileSize) {
      throw new BadRequestException(`File exceeds maximum allowed size of ${this.maxUploadFileSize} bytes`);
    }

    const normalizedMimeType = (file.mimetype || '').toLowerCase().trim();
    if (!normalizedMimeType || !this.allowedMimeTypes.has(normalizedMimeType)) {
      throw new BadRequestException(`File type '${file.mimetype || 'unknown'}' is not allowed`);
    }

    const ext = path.extname(file.originalname || '').toLowerCase();
    if (!ext) {
      throw new BadRequestException('File extension is required');
    }

    if (!this.allowedExtensions.has(ext)) {
      throw new BadRequestException(`File extension '${ext}' is not allowed`);
    }

    if (!this.hasExpectedFileSignature(file.buffer, ext)) {
      throw new BadRequestException('File signature does not match the declared file type');
    }
  }

  private hasExpectedFileSignature(buffer: Buffer, ext: string): boolean {
    if (buffer.length < 4) return false;

    const startsWith = (bytes: number[]) =>
      bytes.every((byte, index) => buffer[index] === byte);

    switch (ext) {
      case '.pdf':
        return startsWith([0x25, 0x50, 0x44, 0x46]); // %PDF
      case '.png':
        return startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      case '.jpg':
      case '.jpeg':
        return startsWith([0xff, 0xd8, 0xff]);
      case '.gif':
        return buffer.subarray(0, 6).toString('ascii') === 'GIF87a'
          || buffer.subarray(0, 6).toString('ascii') === 'GIF89a';
      case '.webp':
        return buffer.subarray(0, 4).toString('ascii') === 'RIFF'
          && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
      case '.tif':
      case '.tiff':
        return startsWith([0x49, 0x49, 0x2a, 0x00]) || startsWith([0x4d, 0x4d, 0x00, 0x2a]);
      case '.doc':
      case '.xls':
        return startsWith([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
      case '.docx':
      case '.xlsx':
        return startsWith([0x50, 0x4b, 0x03, 0x04])
          || startsWith([0x50, 0x4b, 0x05, 0x06])
          || startsWith([0x50, 0x4b, 0x07, 0x08]);
      default:
        return true;
    }
  }

  @Get()
  @UseGuards(PermissionsGuard)
  @RequirePermissions('docket:view')
  @ApiOperation({ summary: 'Get all comments for a docket' })
  async findAll(@Param('docketId') docketId: string) {
    const comments = await this.prisma.docketComment.findMany({
      where: { docketId },
      include: {
        author: { select: { id: true, username: true, email: true } },
        attachment: { select: { id: true, originalFileName: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Return threaded comments while preserving compatibility for flat UIs.
    const byId = new Map<string, any>();
    const roots: any[] = [];
    for (const comment of comments) {
      byId.set(comment.id, { ...comment, replies: [] });
    }

    for (const comment of comments) {
      const current = byId.get(comment.id);
      if (comment.parentCommentId && byId.has(comment.parentCommentId)) {
        byId.get(comment.parentCommentId).replies.push(current);
      } else {
        roots.push(current);
      }
    }

    return roots;
  }

  @Post()
  @UseGuards(PermissionsGuard)
  @RequirePermissions('docket:comment')
  @ApiOperation({ summary: 'Add a comment to docket (immutable)' })
  async create(
    @Param('docketId') docketId: string,
    @Body() dto: CreateCommentDto,
    @CurrentUser('id') userId: string,
  ) {
    if (!dto.content?.trim() && !dto.attachmentId) {
      throw new BadRequestException('Comment content or attachment is required');
    }

    if (dto.parentCommentId) {
      const parent = await this.prisma.docketComment.findFirst({
        where: { id: dto.parentCommentId, docketId },
        select: { id: true },
      });
      if (!parent) {
        throw new BadRequestException('Parent comment not found for this docket');
      }
    }

    const comment = await this.prisma.docketComment.create({
      data: {
        docketId,
        content: dto.content || '',
        commentType: dto.commentType || 'note',
        attachmentId: dto.attachmentId,
        parentCommentId: dto.parentCommentId,
        isInternal: dto.isInternal || false,
        createdBy: userId,
      },
      include: {
        author: { select: { id: true, username: true, email: true } },
        attachment: { select: { id: true, originalFileName: true } },
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'COMMENT',
        resourceType: 'docket_comment',
        resourceId: comment.id,
        docketId,
        details: {
          commentType: comment.commentType,
          isInternal: comment.isInternal,
        },
      },
    });

    const mentions = this.extractMentions(dto.content || '');
    if (mentions.length > 0) {
      const docket = await this.prisma.docket.findUnique({
        where: { id: docketId },
        select: { docketNumber: true, subject: true },
      });

      const users = await this.prisma.user.findMany({
        where: {
          username: { in: mentions },
          isActive: true,
          deletedAt: null,
        },
        select: {
          id: true,
          username: true,
        },
      });

      const notifiedUserIds = new Set<string>();
      for (const user of users) {
        if (user.id === userId || notifiedUserIds.has(user.id)) {
          continue;
        }
        notifiedUserIds.add(user.id);

        try {
          await this.notificationsService.queueNotification({
            type: NotificationType.DOCKET_COMMENT,
            userId: user.id,
            docketId,
            channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL, NotificationChannel.SMS],
            data: {
              docketNumber: docket?.docketNumber || docketId,
              subject: docket?.subject || '',
              mentionedBy: comment.author.username,
              commentSnippet: dto.content.slice(0, 200),
            },
          });
        } catch (error) {
          this.logger.warn(`Failed to queue mention notification for ${user.username}: ${String(error)}`);
        }
      }
    }

    return comment;
  }

  @Post('with-attachment')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('docket:comment')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Add a comment with uploaded attachment' })
  async createWithAttachment(
    @Param('docketId') docketId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreateCommentDto,
    @CurrentUser('id') userId: string,
  ) {
    if (!file) {
      throw new BadRequestException('No attachment file uploaded');
    }
    this.validateAttachmentUpload(file);

    const docket = await this.prisma.docket.findUnique({
      where: { id: docketId },
      select: { id: true },
    });
    if (!docket) {
      throw new BadRequestException('Docket not found');
    }

    const ext = path.extname(file.originalname);
    const storageKey = `${docketId}/comments/${uuidv4()}${ext}`;

    await this.storageService.uploadFile(
      this.storageService.getDocumentsBucket(),
      storageKey,
      file.buffer,
      file.mimetype,
    );

    const fileHash = crypto.createHash('sha256').update(file.buffer).digest('hex');

    const attachment = await this.prisma.docketAttachment.create({
      data: {
        docketId,
        fileName: storageKey,
        originalFileName: file.originalname,
        fileSize: BigInt(file.size),
        mimeType: file.mimetype,
        storageBucket: this.storageService.getDocumentsBucket(),
        storageKey,
        attachmentType: 'supporting',
        description: 'Comment attachment',
        uploadedBy: userId,
        isPrimary: false,
        fileHash,
        hashAlgorithm: 'sha256',
        integrityStatus: 'valid',
        ingestionSource: 'upload',
        ingestionMetadata: {
          scope: 'comment',
        } as Prisma.InputJsonValue,
      },
    });

    await this.documentContentService.queueExtraction(
      attachment.id,
      {
        mimeType: file.mimetype,
        fileName: file.originalname,
        source: 'upload',
      },
      file.buffer,
    );

    return this.create(
      docketId,
      {
        ...dto,
        attachmentId: attachment.id,
      },
      userId,
    );
  }

  private extractMentions(content: string): string[] {
    const matches = content.match(/@([a-zA-Z0-9_.-]+)/g) || [];
    return Array.from(
      new Set(
        matches.map((mention) => mention.slice(1).trim()).filter(Boolean),
      ),
    );
  }
}

import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  HttpCode,
  HttpStatus,
  Logger,
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
import * as crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { DocumentContentService } from './document-content.service';
import { ConfigService } from '@nestjs/config';

// Default hash algorithm for document integrity
const HASH_ALGORITHM = 'sha256';

// Helper function to compute file hash
function computeFileHash(buffer: Buffer, algorithm: string = HASH_ALGORITHM): string {
  return crypto.createHash(algorithm).update(buffer).digest('hex');
}

// Helper to stream to buffer
async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  return new Promise((resolve, reject) => {
    stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

interface ScanUploadDto {
  scannerProvider?: string;
  scannerDevice?: string;
  resolutionDpi?: string;
  colorMode?: string;
  pageCount?: string;
}

@ApiTags('attachments')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('dockets/:docketId/attachments')
export class AttachmentsController {
  private readonly logger = new Logger(AttachmentsController.name);
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
    private readonly storageService: StorageService,
    private readonly documentContentService: DocumentContentService,
    private readonly configService: ConfigService,
  ) {
    this.maxUploadFileSize = this.configService.get<number>('upload.maxFileSize') || (50 * 1024 * 1024);
    const allowed = this.configService.get<string[]>('upload.allowedMimeTypes') || [];
    this.allowedMimeTypes = new Set(allowed.map((value) => value.toLowerCase().trim()));
  }

  private validateUploadedFile(file: Express.Multer.File, source: 'upload' | 'scanner' | 'api' | 'onlyoffice'): void {
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

    if (source === 'scanner' && !['.pdf', '.png', '.jpg', '.jpeg', '.tif', '.tiff'].includes(ext)) {
      throw new BadRequestException('Scanner uploads must be PDF or image files');
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

  private async logAudit(params: {
    userId?: string | null;
    action: string;
    resourceId?: string | null;
    docketId?: string | null;
    details?: Record<string, unknown>;
  }): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: params.userId || null,
          action: params.action,
          resourceType: 'attachment',
          resourceId: params.resourceId || null,
          docketId: params.docketId || null,
          attachmentId: params.resourceId || null,
          details: (params.details as Prisma.InputJsonValue) || {},
        },
      });
    } catch (error) {
      this.logger.warn(`Attachment audit log failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async createAttachment(
    docketId: string,
    file: Express.Multer.File,
    userId: string,
    ingestionSource: 'upload' | 'scanner' | 'api' | 'onlyoffice',
    ingestionMetadata?: Record<string, unknown>,
  ) {
    // Verify docket exists
    const docket = await this.prisma.docket.findUnique({ where: { id: docketId } });
    if (!docket) {
      throw new BadRequestException('Docket not found');
    }

    this.validateUploadedFile(file, ingestionSource);

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

    // Compute file hash for tamper detection
    const fileHash = computeFileHash(file.buffer, HASH_ALGORITHM);

    // Check if this is the first attachment (make it primary)
    const existingAttachments = await this.prisma.docketAttachment.count({
      where: { docketId, deletedAt: null },
    });

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
        fileHash,
        hashAlgorithm: HASH_ALGORITHM,
        integrityStatus: 'valid',
        ingestionSource,
        ingestionMetadata: (ingestionMetadata as Prisma.InputJsonValue) || undefined,
      },
    });

    await this.documentContentService.queueExtraction(
      attachment.id,
      {
        mimeType: file.mimetype,
        fileName: file.originalname,
        source: ingestionSource,
      },
      file.buffer,
    );

    return attachment;
  }

  @Get()
  @UseGuards(PermissionsGuard)
  @RequirePermissions('attachment:view')
  @ApiOperation({ summary: 'List all attachments for a docket' })
  async findAll(@Param('docketId') docketId: string) {
    const attachments = await this.prisma.docketAttachment.findMany({
      where: { docketId, deletedAt: null },
      include: {
        uploader: { select: { id: true, username: true } },
        extractedContent: {
          select: {
            status: true,
            extractionMethod: true,
            language: true,
            confidence: true,
            processedAt: true,
            errorMessage: true,
          },
        },
      },
      orderBy: { uploadedAt: 'desc' },
    });

    // Convert BigInt fileSize to string for JSON serialization
    return attachments.map((att) => ({
      ...att,
      fileSize: att.fileSize.toString(),
    }));
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
    const attachment = await this.createAttachment(
      docketId,
      file,
      userId,
      'upload',
      { uploadedVia: 'manual' },
    );

    await this.logAudit({
      userId,
      action: 'UPLOAD',
      resourceId: attachment.id,
      docketId,
      details: {
        fileName: attachment.originalFileName,
        ingestionSource: 'upload',
      },
    });

    return {
      ...attachment,
      fileSize: attachment.fileSize.toString(),
    };
  }

  @Post('scan')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('attachment:upload')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a scanner-captured attachment to docket' })
  async scanUpload(
    @Param('docketId') docketId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: ScanUploadDto,
    @CurrentUser('id') userId: string,
  ) {
    if (!file) {
      throw new BadRequestException('No scanned file uploaded');
    }

    const metadata: Record<string, unknown> = {
      scannerProvider: dto.scannerProvider || 'unknown',
      scannerDevice: dto.scannerDevice || 'unknown',
      resolutionDpi: dto.resolutionDpi ? Number(dto.resolutionDpi) : null,
      colorMode: dto.colorMode || null,
      pageCount: dto.pageCount ? Number(dto.pageCount) : 1,
      uploadedVia: 'scanner',
      uploadedAt: new Date().toISOString(),
    };

    const attachment = await this.createAttachment(
      docketId,
      file,
      userId,
      'scanner',
      metadata,
    );

    this.logger.log(`Scanner upload completed: docket=${docketId}, attachment=${attachment.id}`);
    await this.logAudit({
      userId,
      action: 'SCAN_UPLOAD',
      resourceId: attachment.id,
      docketId,
      details: {
        fileName: attachment.originalFileName,
        metadata,
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
        extractedContent: true,
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

  @Get(':attachmentId/content')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('attachment:view')
  @ApiOperation({ summary: 'Get extracted OCR/text content for an attachment' })
  async getContent(
    @Param('docketId') docketId: string,
    @Param('attachmentId') attachmentId: string,
  ) {
    const attachment = await this.prisma.docketAttachment.findFirst({
      where: { id: attachmentId, docketId, deletedAt: null },
      select: { id: true, originalFileName: true },
    });

    if (!attachment) {
      throw new BadRequestException('Attachment not found');
    }

    const content = await this.documentContentService.getContent(attachmentId);
    if (!content) {
      return {
        attachmentId,
        fileName: attachment.originalFileName,
        status: 'pending',
        message: 'Text extraction has not started yet.',
      };
    }

    return {
      id: content.id,
      attachmentId,
      fileName: attachment.originalFileName,
      status: content.status,
      extractionMethod: content.extractionMethod,
      language: content.language,
      confidence: content.confidence,
      pageCount: content.pageCount,
      engine: content.engine,
      metadata: content.metadata,
      errorMessage: content.errorMessage,
      processedAt: content.processedAt,
      createdAt: content.createdAt,
      updatedAt: content.updatedAt,
      content: content.content,
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
    @CurrentUser('id') userId: string,
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

    await this.logAudit({
      userId,
      action: 'DELETE',
      resourceId: attachmentId,
      docketId,
      details: {
        mode: 'soft-delete',
      },
    });

    return { message: 'Attachment deleted successfully' };
  }

  @Post(':attachmentId/verify')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('attachment:view')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify attachment integrity using stored hash' })
  async verifyIntegrity(
    @Param('docketId') docketId: string,
    @Param('attachmentId') attachmentId: string,
  ) {
    const attachment = await this.prisma.docketAttachment.findFirst({
      where: { id: attachmentId, docketId, deletedAt: null },
    });

    if (!attachment) {
      throw new BadRequestException('Attachment not found');
    }

    // If no hash was stored, we can't verify
    if (!attachment.fileHash || !attachment.hashAlgorithm) {
      return {
        verified: false,
        status: 'unverified',
        message: 'No hash stored for this attachment. Cannot verify integrity.',
        verifiedAt: null,
      };
    }

    try {
      // Get file from storage
      const stream = await this.storageService.getFile(
        attachment.storageBucket,
        attachment.storageKey,
      );

      // Convert stream to buffer
      const buffer = await streamToBuffer(stream);

      // Compute current hash
      const currentHash = computeFileHash(buffer, attachment.hashAlgorithm);

      // Compare hashes
      const isValid = currentHash === attachment.fileHash;
      const status = isValid ? 'valid' : 'tampered';

      // Update integrity status in database
      await this.prisma.docketAttachment.update({
        where: { id: attachmentId },
        data: {
          integrityStatus: status,
          hashVerifiedAt: new Date(),
        },
      });

      return {
        verified: true,
        status,
        isIntact: isValid,
        storedHash: attachment.fileHash,
        currentHash,
        algorithm: attachment.hashAlgorithm,
        verifiedAt: new Date().toISOString(),
        message: isValid
          ? 'Document integrity verified. The file has not been tampered with.'
          : 'WARNING: Document integrity check failed! The file may have been modified.',
      };
    } catch (error) {
      return {
        verified: false,
        status: 'error',
        message: `Failed to verify integrity: ${error instanceof Error ? error.message : 'Unknown error'}`,
        verifiedAt: null,
      };
    }
  }

  @Get(':attachmentId/integrity')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('attachment:view')
  @ApiOperation({ summary: 'Get attachment integrity status' })
  async getIntegrityStatus(
    @Param('docketId') docketId: string,
    @Param('attachmentId') attachmentId: string,
  ) {
    const attachment = await this.prisma.docketAttachment.findFirst({
      where: { id: attachmentId, docketId, deletedAt: null },
      select: {
        id: true,
        fileHash: true,
        hashAlgorithm: true,
        hashVerifiedAt: true,
        integrityStatus: true,
        originalFileName: true,
      },
    });

    if (!attachment) {
      throw new BadRequestException('Attachment not found');
    }

    return {
      attachmentId: attachment.id,
      fileName: attachment.originalFileName,
      hasHash: !!attachment.fileHash,
      hashAlgorithm: attachment.hashAlgorithm,
      integrityStatus: attachment.integrityStatus,
      lastVerified: attachment.hashVerifiedAt,
      hashPreview: attachment.fileHash
        ? `${attachment.fileHash.substring(0, 8)}...${attachment.fileHash.substring(attachment.fileHash.length - 8)}`
        : null,
    };
  }
}

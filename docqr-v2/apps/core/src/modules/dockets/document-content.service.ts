import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from './storage.service';

type ExtractionMethod = 'ocr' | 'text' | 'hybrid' | 'none';

interface ExtractionContext {
  mimeType: string;
  fileName: string;
  source?: 'upload' | 'scanner' | 'api' | 'onlyoffice';
}

interface ExtractionResult {
  status: 'completed' | 'failed' | 'skipped';
  method: ExtractionMethod;
  text: string;
  language?: string;
  confidence?: number;
  pageCount?: number;
  engine?: string;
  metadata?: Record<string, unknown>;
  errorMessage?: string;
}

@Injectable()
export class DocumentContentService {
  private readonly logger = new Logger(DocumentContentService.name);
  private readonly enabled: boolean;
  private readonly language: string;
  private readonly maxFileSizeBytes: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly configService: ConfigService,
  ) {
    this.enabled = this.configService.get<boolean>('ocr.enabled') ?? true;
    this.language = this.configService.get<string>('ocr.language') || 'eng';
    this.maxFileSizeBytes = this.configService.get<number>('ocr.maxFileSize') || 20 * 1024 * 1024;
  }

  async queueExtraction(
    attachmentId: string,
    context: ExtractionContext,
    fileBuffer?: Buffer,
  ): Promise<void> {
    if (!this.enabled) {
      await this.prisma.documentContent.upsert({
        where: { attachmentId },
        create: {
          attachmentId,
          status: 'skipped',
          extractionMethod: 'none',
          content: '',
          metadata: {
            reason: 'OCR disabled by configuration',
            source: context.source || 'upload',
          },
          processedAt: new Date(),
        },
        update: {
          status: 'skipped',
          extractionMethod: 'none',
          content: '',
          metadata: {
            reason: 'OCR disabled by configuration',
            source: context.source || 'upload',
          },
          processedAt: new Date(),
          errorMessage: null,
        },
      });
      return;
    }

    await this.prisma.documentContent.upsert({
      where: { attachmentId },
      create: {
        attachmentId,
        status: 'processing',
        extractionMethod: 'none',
        content: '',
        metadata: { source: context.source || 'upload' },
      },
      update: {
        status: 'processing',
        extractionMethod: 'none',
        content: '',
        metadata: { source: context.source || 'upload' },
        errorMessage: null,
      },
    });

    // Fire-and-forget processing keeps upload latency low.
    setImmediate(() => {
      void this.processExtraction(attachmentId, context, fileBuffer);
    });
  }

  async getContent(attachmentId: string) {
    return this.prisma.documentContent.findUnique({
      where: { attachmentId },
    });
  }

  private async processExtraction(
    attachmentId: string,
    context: ExtractionContext,
    fileBuffer?: Buffer,
  ): Promise<void> {
    try {
      const attachment = await this.prisma.docketAttachment.findUnique({
        where: { id: attachmentId },
        select: {
          storageBucket: true,
          storageKey: true,
          fileSize: true,
          deletedAt: true,
        },
      });

      if (!attachment || attachment.deletedAt) {
        await this.writeFailedResult(attachmentId, 'Attachment not found while processing OCR.');
        return;
      }

      if (Number(attachment.fileSize) > this.maxFileSizeBytes) {
        await this.prisma.documentContent.update({
          where: { attachmentId },
          data: {
            status: 'skipped',
            extractionMethod: 'none',
            content: '',
            metadata: {
              reason: `File exceeds OCR max size (${this.maxFileSizeBytes} bytes)`,
              mimeType: context.mimeType,
            },
            processedAt: new Date(),
          },
        });
        return;
      }

      const buffer = fileBuffer || await this.storageService.getFileBuffer(
        attachment.storageBucket,
        attachment.storageKey,
      );

      const result = await this.extractText(buffer, context);

      await this.prisma.documentContent.update({
        where: { attachmentId },
        data: {
          status: result.status,
          extractionMethod: result.method,
          content: result.text,
          language: result.language,
          confidence: result.confidence,
          pageCount: result.pageCount,
          engine: result.engine,
          metadata: {
            ...(result.metadata || {}),
            mimeType: context.mimeType,
            fileName: context.fileName,
          },
          errorMessage: result.errorMessage || null,
          processedAt: new Date(),
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown OCR processing error';
      this.logger.error(`OCR processing failed for attachment ${attachmentId}: ${message}`);
      await this.writeFailedResult(attachmentId, message);
    }
  }

  private async writeFailedResult(attachmentId: string, errorMessage: string): Promise<void> {
    await this.prisma.documentContent.update({
      where: { attachmentId },
      data: {
        status: 'failed',
        extractionMethod: 'none',
        content: '',
        errorMessage,
        processedAt: new Date(),
      },
    });
  }

  private async extractText(buffer: Buffer, context: ExtractionContext): Promise<ExtractionResult> {
    const mime = context.mimeType.toLowerCase();
    const fileName = context.fileName.toLowerCase();

    if (mime.startsWith('text/')) {
      return {
        status: 'completed',
        method: 'text',
        text: this.sanitizeText(buffer.toString('utf-8')),
        engine: 'native',
      };
    }

    if (mime === 'application/pdf' || fileName.endsWith('.pdf')) {
      return this.extractFromPdf(buffer);
    }

    if (
      mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      || fileName.endsWith('.docx')
    ) {
      return this.extractFromDocx(buffer);
    }

    if (mime.startsWith('image/') || this.isImageFile(fileName)) {
      return this.extractFromImage(buffer);
    }

    return {
      status: 'skipped',
      method: 'none',
      text: '',
      metadata: {
        reason: 'Unsupported file type for extraction',
      },
    };
  }

  private async extractFromPdf(buffer: Buffer): Promise<ExtractionResult> {
    // pdf-parse does not ship first-party TS types in this setup.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pdfParse = require('pdf-parse');
    const parsed = await pdfParse(buffer);
    const text = this.sanitizeText(parsed.text || '');

    if (!text) {
      return {
        status: 'skipped',
        method: 'text',
        text: '',
        engine: 'pdf-parse',
        pageCount: parsed.numpages,
        metadata: {
          reason: 'No extractable text in PDF',
        },
      };
    }

    return {
      status: 'completed',
      method: 'text',
      text,
      pageCount: parsed.numpages,
      engine: 'pdf-parse',
      metadata: {
        pdfVersion: parsed.version,
      },
    };
  }

  private async extractFromDocx(buffer: Buffer): Promise<ExtractionResult> {
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    const text = this.sanitizeText(result.value || '');

    if (!text) {
      return {
        status: 'skipped',
        method: 'text',
        text: '',
        engine: 'mammoth',
        metadata: {
          reason: 'No extractable text in DOCX',
          messages: result.messages,
        },
      };
    }

    return {
      status: 'completed',
      method: 'text',
      text,
      engine: 'mammoth',
      metadata: {
        messages: result.messages,
      },
    };
  }

  private async extractFromImage(buffer: Buffer): Promise<ExtractionResult> {
    const tesseract = await import('tesseract.js');
    const recognize = (tesseract as any).recognize;

    const result = await recognize(buffer, this.language);
    const text = this.sanitizeText(result.data?.text || '');
    const confidenceRaw = Number(result.data?.confidence || 0);

    if (!text) {
      return {
        status: 'skipped',
        method: 'ocr',
        text: '',
        language: this.language,
        confidence: confidenceRaw,
        engine: 'tesseract.js',
        metadata: {
          reason: 'OCR completed but no readable text found',
        },
      };
    }

    return {
      status: 'completed',
      method: 'ocr',
      text,
      language: this.language,
      confidence: confidenceRaw,
      engine: 'tesseract.js',
    };
  }

  private isImageFile(fileName: string): boolean {
    return ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.tif', '.tiff', '.webp']
      .some((ext) => fileName.endsWith(ext));
  }

  private sanitizeText(text: string): string {
    return text.replace(/\u0000/g, '').replace(/\r\n/g, '\n').trim();
  }
}

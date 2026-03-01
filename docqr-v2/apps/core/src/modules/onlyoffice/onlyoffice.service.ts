import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../dockets/storage.service';
import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';

export interface EditorConfig {
  document: {
    fileType: string;
    key: string;
    title: string;
    url: string;
    permissions: {
      comment: boolean;
      download: boolean;
      edit: boolean;
      print: boolean;
      review: boolean;
    };
  };
  documentType: 'word' | 'cell' | 'slide';
  editorConfig: {
    callbackUrl: string;
    lang: string;
    mode: 'view' | 'edit';
    user: {
      id: string;
      name: string;
    };
    customization: {
      autosave: boolean;
      chat: boolean;
      comments: boolean;
      compactHeader: boolean;
      compactToolbar: boolean;
      feedback: boolean;
      forcesave: boolean;
      help: boolean;
      hideRightMenu: boolean;
      showReviewChanges: boolean;
    };
  };
  token?: string;
}

@Injectable()
export class OnlyOfficeService {
  private readonly logger = new Logger(OnlyOfficeService.name);
  private readonly jwtSecret: string;
  private readonly serverUrl: string;
  private readonly apiBaseUrl: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {
    this.jwtSecret = this.configService.get<string>('onlyOffice.jwtSecret') || 'onlyoffice-secret';
    this.serverUrl = this.configService.get<string>('onlyOffice.serverUrl') || 'http://localhost:8080';
    this.apiBaseUrl = this.configService.get<string>('qrCode.baseUrl') || 'http://localhost:3000';
  }

  /**
   * Get file extension from filename
   */
  private getFileExtension(filename: string): string {
    return filename.split('.').pop()?.toLowerCase() || '';
  }

  /**
   * Determine document type from extension
   */
  private getDocumentType(extension: string): 'word' | 'cell' | 'slide' {
    const wordExts = ['doc', 'docx', 'docm', 'dot', 'dotx', 'dotm', 'odt', 'fodt', 'ott', 'rtf', 'txt', 'html', 'htm', 'mht', 'pdf', 'djvu', 'fb2', 'epub', 'xps'];
    const cellExts = ['xls', 'xlsx', 'xlsm', 'xlt', 'xltx', 'xltm', 'ods', 'fods', 'ots', 'csv'];
    const slideExts = ['pps', 'ppsx', 'ppsm', 'ppt', 'pptx', 'pptm', 'pot', 'potx', 'potm', 'odp', 'fodp', 'otp'];

    if (cellExts.includes(extension)) return 'cell';
    if (slideExts.includes(extension)) return 'slide';
    return 'word';
  }

  /**
   * Generate a unique document key (changes when document is modified)
   * Format: attachmentId_version_hash (so we can extract attachmentId in callback)
   */
  private generateDocumentKey(attachmentId: string, version: number): string {
    const hash = crypto.createHash('md5').update(`${Date.now()}`).digest('hex').substring(0, 8);
    return `${attachmentId}_v${version}_${hash}`;
  }

  /**
   * Sign config with JWT for OnlyOffice
   */
  private signConfig(config: EditorConfig): string {
    return jwt.sign(config, this.jwtSecret, { expiresIn: '1h' });
  }

  /**
   * Get editor configuration for an attachment
   */
  async getEditorConfig(
    attachmentId: string,
    userId: string,
    mode: 'view' | 'edit' = 'edit',
  ): Promise<{ config: EditorConfig; onlyOfficeUrl: string }> {
    // Get attachment details
    const attachment = await this.prisma.docketAttachment.findUnique({
      where: { id: attachmentId },
      include: {
        docket: true,
        uploader: { select: { id: true, username: true, firstName: true, lastName: true } },
      },
    });

    if (!attachment) {
      throw new BadRequestException('Attachment not found');
    }

    if (attachment.deletedAt) {
      throw new BadRequestException('Attachment has been deleted');
    }

    // Get current user
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, firstName: true, lastName: true },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    const fileName = attachment.originalFileName;
    const extension = this.getFileExtension(fileName);
    const documentType = this.getDocumentType(extension);
    const documentKey = this.generateDocumentKey(attachmentId, attachment.version || 1);

    // Generate document URL (the URL OnlyOffice will use to fetch the document)
    const documentUrl = `${this.apiBaseUrl}/api/v1/onlyoffice/download/${attachmentId}`;

    // Callback URL for saving
    const callbackUrl = `${this.apiBaseUrl}/api/v1/onlyoffice/callback`;

    const userName = user.firstName
      ? `${user.firstName} ${user.lastName || ''}`.trim()
      : user.username;

    const config: EditorConfig = {
      document: {
        fileType: extension,
        key: documentKey,
        title: fileName,
        url: documentUrl,
        permissions: {
          comment: true,
          download: true,
          edit: mode === 'edit',
          print: true,
          review: true,
        },
      },
      documentType,
      editorConfig: {
        callbackUrl,
        lang: 'en',
        mode,
        user: {
          id: userId,
          name: userName,
        },
        customization: {
          autosave: true,
          chat: true,
          comments: true,
          compactHeader: false,
          compactToolbar: false,
          feedback: false,
          forcesave: true,
          help: true,
          hideRightMenu: false,
          showReviewChanges: true,
        },
      },
    };

    // Sign the config with JWT
    config.token = this.signConfig(config);

    this.logger.log(`Generated editor config for attachment ${attachmentId}, mode: ${mode}`);

    return {
      config,
      onlyOfficeUrl: `${this.serverUrl}/web-apps/apps/api/documents/api.js`,
    };
  }

  /**
   * Get file for OnlyOffice to download
   */
  async getFileForDownload(attachmentId: string): Promise<{ stream: NodeJS.ReadableStream; mimeType: string; fileName: string }> {
    const attachment = await this.prisma.docketAttachment.findUnique({
      where: { id: attachmentId },
    });

    if (!attachment || attachment.deletedAt) {
      throw new BadRequestException('Attachment not found');
    }

    const stream = await this.storageService.getFile(
      attachment.storageBucket,
      attachment.storageKey,
    );

    return {
      stream,
      mimeType: attachment.mimeType,
      fileName: attachment.originalFileName,
    };
  }

  /**
   * Handle callback from OnlyOffice when document is saved
   */
  async handleCallback(body: any): Promise<{ error: number }> {
    this.logger.log(`OnlyOffice callback received: ${JSON.stringify(body)}`);

    const { status, key, url, users } = body;

    // Status codes:
    // 0 - no document with the key identifier could be found
    // 1 - document is being edited
    // 2 - document is ready for saving
    // 3 - document saving error has occurred
    // 4 - document is closed with no changes
    // 6 - document is being edited, but the current document state is saved
    // 7 - error has occurred while force saving the document

    if (status === 2 || status === 6) {
      // Document is ready to be saved
      try {
        // Extract attachment ID from the key (we encoded it in the key)
        // For now, we'll need to find the attachment by the document key
        // This is a simplified implementation - in production, you'd want to
        // store the key mapping in the database

        if (url) {
          // Download the file from OnlyOffice and save it
          const response = await fetch(url);
          const buffer = Buffer.from(await response.arrayBuffer());

          // Extract attachment ID from the key (format: attachmentId_vN_hash)
          // The key pattern is: {uuid}_v{version}_{hash}
          const keyParts = key.split('_v');
          const attachmentId = keyParts[0];

          if (attachmentId && attachmentId.length >= 32) {
            const attachment = await this.prisma.docketAttachment.findUnique({
              where: { id: attachmentId },
            });

            if (attachment) {
              // Upload the new version
              await this.storageService.uploadFile(
                attachment.storageBucket,
                attachment.storageKey,
                buffer,
                attachment.mimeType,
              );

              // Update the version number
              await this.prisma.docketAttachment.update({
                where: { id: attachmentId },
                data: {
                  version: (attachment.version || 1) + 1,
                  fileSize: BigInt(buffer.length),
                  lastEditedAt: new Date(),
                  lastEditedBy: users?.[0] || null,
                },
              });

              this.logger.log(`Document saved successfully: ${attachmentId}`);
            }
          }
        }

        return { error: 0 };
      } catch (error) {
        this.logger.error(`Error saving document: ${error}`);
        return { error: 1 };
      }
    }

    // For other statuses, just acknowledge
    return { error: 0 };
  }

  /**
   * Verify JWT token from OnlyOffice
   */
  verifyToken(token: string): any {
    try {
      return jwt.verify(token, this.jwtSecret);
    } catch {
      throw new BadRequestException('Invalid token');
    }
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as QRCode from 'qrcode';
import * as crypto from 'crypto';

export interface QrCodeResult {
  token: string;
  buffer: Buffer;
  dataUrl: string;
}

@Injectable()
export class QrCodeService {
  private readonly logger = new Logger(QrCodeService.name);
  private readonly baseUrl: string;
  private readonly size: number;
  private readonly errorCorrection: string;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl = this.configService.get<string>('qrCode.baseUrl') || 'http://localhost:3000';
    this.size = this.configService.get<number>('qrCode.size') || 300;
    this.errorCorrection = this.configService.get<string>('qrCode.errorCorrection') || 'M';
  }

  /**
   * Generate a secure token for QR code
   * This token is cryptographically random and doesn't expose the docket ID
   */
  generateSecureToken(): string {
    // Generate 32 bytes of random data and encode as base64url
    const randomBytes = crypto.randomBytes(32);
    const token = randomBytes
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');

    return token;
  }

  /**
   * Generate QR code for a docket
   */
  async generateQrCode(docketId: string, token: string): Promise<QrCodeResult> {
    // The QR code contains a secure URL with the token
    const scanUrl = `${this.baseUrl}/scan/${token}`;

    const options: QRCode.QRCodeToBufferOptions = {
      errorCorrectionLevel: this.errorCorrection as 'L' | 'M' | 'Q' | 'H',
      type: 'png',
      width: this.size,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    };

    try {
      const buffer = await QRCode.toBuffer(scanUrl, options);
      const dataUrl = await QRCode.toDataURL(scanUrl, options);

      this.logger.log(`QR code generated for docket: ${docketId}`);

      return {
        token,
        buffer,
        dataUrl,
      };
    } catch (error) {
      this.logger.error(`Failed to generate QR code for docket ${docketId}:`, error);
      throw error;
    }
  }

  /**
   * Regenerate QR code with a new token
   */
  async regenerateQrCode(docketId: string): Promise<QrCodeResult> {
    const newToken = this.generateSecureToken();
    return this.generateQrCode(docketId, newToken);
  }

  /**
   * Get the scan URL for a token
   */
  getScanUrl(token: string): string {
    return `${this.baseUrl}/scan/${token}`;
  }
}

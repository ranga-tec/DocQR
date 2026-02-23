import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';
import * as fs from 'fs';
import * as path from 'path';
import { Readable } from 'stream';

export interface UploadedFile {
  bucket: string;
  key: string;
  size: number;
  mimeType: string;
}

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private minioClient: Minio.Client | null = null;
  private readonly useLocal: boolean;
  private readonly uploadsDir: string;
  private readonly buckets: { documents: string; qrCodes: string };

  constructor(private readonly configService: ConfigService) {
    this.useLocal = this.configService.get<boolean>('storage.useLocal') || false;
    this.uploadsDir = this.configService.get<string>('storage.uploadsDir') || './uploads';
    this.buckets = {
      documents: this.configService.get<string>('storage.minio.buckets.documents') || 'documents',
      qrCodes: this.configService.get<string>('storage.minio.buckets.qrCodes') || 'qr-codes',
    };
  }

  async onModuleInit() {
    if (this.useLocal) {
      await this.initLocalStorage();
    } else {
      await this.initMinioClient();
    }
  }

  private async initLocalStorage() {
    // Create directories for local storage
    const documentsDir = path.join(this.uploadsDir, this.buckets.documents);
    const qrCodesDir = path.join(this.uploadsDir, this.buckets.qrCodes);

    for (const dir of [documentsDir, qrCodesDir]) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        this.logger.log(`Created local storage directory: ${dir}`);
      }
    }

    this.logger.log('Local storage initialized');
  }

  private async initMinioClient() {
    const endpoint = this.configService.get<string>('storage.minio.endpoint');
    const port = this.configService.get<number>('storage.minio.port');
    const useSSL = this.configService.get<boolean>('storage.minio.useSSL');
    const accessKey = this.configService.get<string>('storage.minio.accessKey');
    const secretKey = this.configService.get<string>('storage.minio.secretKey');

    if (!endpoint || !accessKey || !secretKey) {
      this.logger.warn('MinIO not configured, falling back to local storage');
      await this.initLocalStorage();
      return;
    }

    try {
      this.minioClient = new Minio.Client({
        endPoint: endpoint,
        port: port || 9000,
        useSSL: useSSL || false,
        accessKey,
        secretKey,
      });

      // Ensure buckets exist
      for (const bucket of Object.values(this.buckets)) {
        const exists = await this.minioClient.bucketExists(bucket);
        if (!exists) {
          await this.minioClient.makeBucket(bucket);
          this.logger.log(`Created MinIO bucket: ${bucket}`);
        }
      }

      this.logger.log('MinIO client initialized');
    } catch (error) {
      this.logger.error('Failed to initialize MinIO, falling back to local storage', error);
      this.minioClient = null;
      await this.initLocalStorage();
    }
  }

  /**
   * Upload a file to storage
   */
  async uploadFile(
    bucket: string,
    key: string,
    data: Buffer,
    mimeType: string,
  ): Promise<UploadedFile> {
    if (this.minioClient) {
      await this.minioClient.putObject(bucket, key, data, data.length, {
        'Content-Type': mimeType,
      });
    } else {
      // Local storage
      const filePath = path.join(this.uploadsDir, bucket, key);
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(filePath, data);
    }

    this.logger.log(`File uploaded: ${bucket}/${key}`);

    return {
      bucket,
      key,
      size: data.length,
      mimeType,
    };
  }

  /**
   * Get a file from storage
   */
  async getFile(bucket: string, key: string): Promise<Readable> {
    if (this.minioClient) {
      return await this.minioClient.getObject(bucket, key);
    } else {
      const filePath = path.join(this.uploadsDir, bucket, key);
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${bucket}/${key}`);
      }
      return fs.createReadStream(filePath);
    }
  }

  /**
   * Get file as buffer
   */
  async getFileBuffer(bucket: string, key: string): Promise<Buffer> {
    const stream = await this.getFile(bucket, key);
    const chunks: Buffer[] = [];

    return new Promise((resolve, reject) => {
      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
  }

  /**
   * Delete a file from storage
   */
  async deleteFile(bucket: string, key: string): Promise<void> {
    if (this.minioClient) {
      await this.minioClient.removeObject(bucket, key);
    } else {
      const filePath = path.join(this.uploadsDir, bucket, key);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    this.logger.log(`File deleted: ${bucket}/${key}`);
  }

  /**
   * Check if file exists
   */
  async fileExists(bucket: string, key: string): Promise<boolean> {
    try {
      if (this.minioClient) {
        await this.minioClient.statObject(bucket, key);
        return true;
      } else {
        const filePath = path.join(this.uploadsDir, bucket, key);
        return fs.existsSync(filePath);
      }
    } catch {
      return false;
    }
  }

  /**
   * Get presigned URL for download (MinIO only)
   */
  async getPresignedUrl(bucket: string, key: string, expiresIn: number = 3600): Promise<string> {
    if (this.minioClient) {
      return await this.minioClient.presignedGetObject(bucket, key, expiresIn);
    } else {
      // For local storage, return an API endpoint URL
      const baseUrl = this.configService.get<string>('qrCode.baseUrl') || 'http://localhost:3000';
      return `${baseUrl}/api/v1/storage/${bucket}/${key}`;
    }
  }

  /**
   * Get bucket name for documents
   */
  getDocumentsBucket(): string {
    return this.buckets.documents;
  }

  /**
   * Get bucket name for QR codes
   */
  getQrCodesBucket(): string {
    return this.buckets.qrCodes;
  }
}

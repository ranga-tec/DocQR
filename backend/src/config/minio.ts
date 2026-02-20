import * as Minio from 'minio';
import { config } from '../config';

class MinioClient {
    private client: Minio.Client;
    private bucketsInitialized: boolean = false;

    constructor() {
        const endPoint = config.minio.endPoint.replace(/^https?:\/\//, '');
        const useSSL = config.minio.useSSL || config.minio.endPoint.startsWith('https://') || config.minio.port === 443;
        const port = (config.minio.port === 443 || config.minio.port === 80) ? undefined : config.minio.port;

        this.client = new Minio.Client({
            endPoint,
            port,
            useSSL,
            accessKey: config.minio.accessKey,
            secretKey: config.minio.secretKey,
        });
    }

    async initializeBuckets(): Promise<void> {
        if (this.bucketsInitialized) return;

        try {
            const buckets = [
                config.minio.buckets.documents,
                config.minio.buckets.qrCodes,
            ];

            for (const bucket of buckets) {
                const exists = await this.client.bucketExists(bucket);
                if (!exists) {
                    await this.client.makeBucket(bucket, 'us-east-1');
                    console.log(`Created bucket: ${bucket}`);
                }
            }

            this.bucketsInitialized = true;
            console.log('MinIO buckets initialized successfully');
        } catch (error) {
            console.error('Error initializing MinIO buckets:', error);
            throw error;
        }
    }

    async uploadFile(
        bucket: string,
        objectName: string,
        stream: Buffer | any,
        size?: number,
        metadata?: Minio.ItemBucketMetadata
    ): Promise<any> {
        try {
            const result = await this.client.putObject(bucket, objectName, stream, size, metadata);
            return result;
        } catch (error) {
            console.error('Error uploading file to MinIO:', error);
            throw error;
        }
    }

    async getFile(bucket: string, objectName: string): Promise<NodeJS.ReadableStream> {
        try {
            return await this.client.getObject(bucket, objectName);
        } catch (error) {
            console.error('Error getting file from MinIO:', error);
            throw error;
        }
    }

    async deleteFile(bucket: string, objectName: string): Promise<void> {
        try {
            await this.client.removeObject(bucket, objectName);
        } catch (error) {
            console.error('Error deleting file from MinIO:', error);
            throw error;
        }
    }

    async getPresignedUrl(
        bucket: string,
        objectName: string,
        expiry: number = 24 * 60 * 60 // 24 hours
    ): Promise<string> {
        try {
            return await this.client.presignedGetObject(bucket, objectName, expiry);
        } catch (error) {
            console.error('Error generating presigned URL:', error);
            throw error;
        }
    }

    async fileExists(bucket: string, objectName: string): Promise<boolean> {
        try {
            await this.client.statObject(bucket, objectName);
            return true;
        } catch (error: any) {
            if (error.code === 'NotFound') {
                return false;
            }
            throw error;
        }
    }

    getClient(): Minio.Client {
        return this.client;
    }
}

export const minioClient = new MinioClient();

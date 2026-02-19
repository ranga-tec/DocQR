import * as fs from 'fs';
import * as path from 'path';

// Simple local filesystem storage adapter that mimics MinIO interface
// Used as fallback when MinIO is not configured
const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(process.cwd(), 'uploads');

class LocalStorageClient {
    private bucketsInitialized: boolean = false;

    async initializeBuckets(): Promise<void> {
        if (this.bucketsInitialized) return;
        const buckets = ['documents', 'qr-codes'];
        for (const bucket of buckets) {
            const dir = path.join(UPLOADS_DIR, bucket);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        }
        this.bucketsInitialized = true;
        console.log('✓ Local storage buckets initialized at:', UPLOADS_DIR);
    }

    async uploadFile(bucket: string, objectName: string, stream: Buffer | any, _size?: number, _metadata?: any): Promise<any> {
        const dir = path.join(UPLOADS_DIR, bucket);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        const filePath = path.join(dir, objectName);
        const buffer = Buffer.isBuffer(stream) ? stream : Buffer.from(stream);
        fs.writeFileSync(filePath, buffer);
        return { etag: 'local', versionId: null };
    }

    async getFile(bucket: string, objectName: string): Promise<NodeJS.ReadableStream> {
        const filePath = path.join(UPLOADS_DIR, bucket, objectName);
        if (!fs.existsSync(filePath)) throw new Error(`File not found: ${objectName}`);
        return fs.createReadStream(filePath);
    }

    async deleteFile(bucket: string, objectName: string): Promise<void> {
        const filePath = path.join(UPLOADS_DIR, bucket, objectName);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    async getPresignedUrl(bucket: string, objectName: string, _expiry?: number): Promise<string> {
        // For local storage, return a direct API endpoint URL
        const appBaseUrl = process.env.APP_BASE_URL || 'http://localhost:3000';
        return `${appBaseUrl}/api/documents/file/${bucket}/${objectName}`;
    }

    async fileExists(bucket: string, objectName: string): Promise<boolean> {
        const filePath = path.join(UPLOADS_DIR, bucket, objectName);
        return fs.existsSync(filePath);
    }

    getClient(): any {
        return null; // No raw client for local storage
    }
}

export const localStorageClient = new LocalStorageClient();

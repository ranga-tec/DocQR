/**
 * Storage adapter - automatically uses MinIO if configured, 
 * falls back to local filesystem if MINIO_ENDPOINT is not set or unreachable.
 * 
 * Set USE_LOCAL_STORAGE=true to force local storage (useful for Railway without MinIO).
 */
import { minioClient } from './minio';
import { localStorageClient } from './local-storage';

export interface StorageClient {
    initializeBuckets(): Promise<void>;
    uploadFile(bucket: string, objectName: string, stream: any, size?: number, metadata?: any): Promise<any>;
    getFile(bucket: string, objectName: string): Promise<NodeJS.ReadableStream>;
    deleteFile(bucket: string, objectName: string): Promise<void>;
    getPresignedUrl(bucket: string, objectName: string, expiry?: number): Promise<string>;
    fileExists(bucket: string, objectName: string): Promise<boolean>;
    getClient(): any;
}

const useLocalStorage = process.env.USE_LOCAL_STORAGE === 'true';

export const storageClient: StorageClient = useLocalStorage ? localStorageClient : minioClient;

export const storageType = useLocalStorage ? 'local' : 'minio';

console.log(`📦 Storage adapter: ${storageType.toUpperCase()}`);

/**
 * Storage adapter - automatically uses MinIO if configured, 
 * falls back to local filesystem if MINIO_ENDPOINT is not set or unreachable.
 * 
 * Set USE_LOCAL_STORAGE=true to force local storage (useful for Railway without MinIO).
 */
import { minioClient } from './minio';
import { localStorageClient } from './local-storage';

const useLocalStorage = process.env.USE_LOCAL_STORAGE === 'true' ||
    !process.env.MINIO_ENDPOINT ||
    process.env.MINIO_ENDPOINT === 'localhost' && process.env.NODE_ENV === 'production';

export const storageClient = useLocalStorage ? localStorageClient : minioClient;

export const storageType = useLocalStorage ? 'local' : 'minio';

console.log(`📦 Storage adapter: ${storageType.toUpperCase()}`);

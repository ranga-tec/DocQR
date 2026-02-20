import { db } from '../config/database';

export async function checkAndRepairSchema() {
    console.log('🔧 Checking database schema health...');

    try {
        // 1. Ensure tables exist (Basic check)
        // We use CREATE TABLE IF NOT EXISTS for the critical tables

        // Documents table
        await db.query(`
            CREATE TABLE IF NOT EXISTS documents (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                title VARCHAR(255) NOT NULL,
                description TEXT,
                category_id UUID,
                file_name VARCHAR(255) NOT NULL,
                file_size BIGINT NOT NULL,
                mime_type VARCHAR(100) NOT NULL,
                minio_bucket VARCHAR(100) NOT NULL,
                minio_object_key VARCHAR(255) NOT NULL,
                qr_code_path VARCHAR(255),
                qr_code_data TEXT NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                created_by UUID,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_by UUID,
                deleted_at TIMESTAMP WITH TIME ZONE
            )
        `);

        // Document Tags table
        await db.query(`
            CREATE TABLE IF NOT EXISTS document_tags (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                document_id UUID NOT NULL,
                tag VARCHAR(50) NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(document_id, tag)
            )
        `);

        // 2. Add missing columns to 'documents' table if it was created with old schema
        // We use ALTER TABLE ... ADD COLUMN IF NOT EXISTS (requires Postgres 9.6+)
        // Providing defaults is critical for existing rows

        const alterQueries = [
            `ALTER TABLE documents ADD COLUMN IF NOT EXISTS minio_bucket VARCHAR(100) NOT NULL DEFAULT 'documents'`,
            `ALTER TABLE documents ADD COLUMN IF NOT EXISTS minio_object_key VARCHAR(255) NOT NULL DEFAULT 'unknown'`,
            `ALTER TABLE documents ADD COLUMN IF NOT EXISTS qr_code_path VARCHAR(255)`,
            `ALTER TABLE documents ADD COLUMN IF NOT EXISTS qr_code_data TEXT NOT NULL DEFAULT ''`,
            `ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_size BIGINT NOT NULL DEFAULT 0`,
            `ALTER TABLE documents ADD COLUMN IF NOT EXISTS mime_type VARCHAR(100) NOT NULL DEFAULT 'application/octet-stream'`,
            `ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_name VARCHAR(255) NOT NULL DEFAULT 'untitled'`
        ];

        for (const query of alterQueries) {
            await db.query(query);
        }

        // 3. Ensure 'gen_random_uuid()' or 'uuid_generate_v4()' works
        // We tried 'gen_random_uuid()' (pgcrypto/standard in v13+) above. 
        // If 'uuid-ossp' is preferred, we can enable it:
        try {
            await db.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
        } catch (e) {
            // Ignore extension error (might not have permissions)
        }

        console.log('✅ Schema check/repair completed successfully.');
    } catch (error) {
        console.error('❌ Schema repair failed:', error);
        console.error('   Non-fatal: Application will try to proceed, but expect 500 errors if schema is invalid.');
    }
}

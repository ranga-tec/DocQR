import { db } from '../config/database';

export async function checkAndRepairSchema() {
    console.log('🔧 Checking database schema health...');

    try {
        // 1. Ensure required extensions exist
        try {
            await db.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
        } catch (e) {
            // Ignore (might lack permissions)
        }

        // 2. Ensure tables exist (CREATE TABLE IF NOT EXISTS)

        // Users table
        await db.query(`
            CREATE TABLE IF NOT EXISTS users (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                username VARCHAR(50) UNIQUE NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                role VARCHAR(20) NOT NULL DEFAULT 'user',
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Document Categories table
        await db.query(`
            CREATE TABLE IF NOT EXISTS document_categories (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name VARCHAR(100) UNIQUE NOT NULL,
                description TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                created_by UUID,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_by UUID
            )
        `);

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

        // Audit Logs table (CRITICAL: Used by middleware)
        await db.query(`
            CREATE TABLE IF NOT EXISTS audit_logs (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID,
                action VARCHAR(50) NOT NULL,
                resource_type VARCHAR(50) NOT NULL,
                resource_id UUID,
                details JSONB,
                ip_address VARCHAR(45),
                user_agent TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // 3. Add missing columns (ALTER TABLE IF NOT EXISTS)

        const alterQueries = [
            // Documents table
            `ALTER TABLE documents ADD COLUMN IF NOT EXISTS minio_bucket VARCHAR(100) NOT NULL DEFAULT 'documents'`,
            `ALTER TABLE documents ADD COLUMN IF NOT EXISTS minio_object_key VARCHAR(255) NOT NULL DEFAULT 'unknown'`,
            `ALTER TABLE documents ADD COLUMN IF NOT EXISTS qr_code_path VARCHAR(255)`,
            `ALTER TABLE documents ADD COLUMN IF NOT EXISTS qr_code_data TEXT NOT NULL DEFAULT ''`,
            `ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_size BIGINT NOT NULL DEFAULT 0`,
            `ALTER TABLE documents ADD COLUMN IF NOT EXISTS mime_type VARCHAR(100) NOT NULL DEFAULT 'application/octet-stream'`,
            `ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_name VARCHAR(255) NOT NULL DEFAULT 'untitled'`,

            // Users table
            `ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true`,
            `ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'user'`,

            // Audit Logs
            `ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS details JSONB`
        ];

        for (const query of alterQueries) {
            await db.query(query);
        }

        console.log('✅ Schema check/repair completed successfully (All tables verified).');
    } catch (error) {
        console.error('❌ Schema repair failed:', error);
        console.error('   Non-fatal: Application will try to proceed, but expect 500 errors if schema is invalid.');
    }
}

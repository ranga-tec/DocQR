import { db } from '../config/database';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

async function seed() {
    console.log('🌱 Seeding database...');

    try {
        // Create default categories
        const categories = [
            { name: 'Legal', description: 'Legal documents and contracts' },
            { name: 'Financial', description: 'Financial reports and statements' },
            { name: 'HR', description: 'Human resources documents' },
            { name: 'Technical', description: 'Technical specifications and manuals' },
            { name: 'Marketing', description: 'Marketing materials and assets' }
        ];

        // Seed Admin User
        const adminPassword = await bcrypt.hash('admin123', 10);
        const adminId = uuidv4();

        // Use UPSERT to avoid duplicates if re-running
        const adminResult = await db.query(`
            INSERT INTO users (id, username, email, password_hash, role, is_active)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (email) DO UPDATE 
            SET username = EXCLUDED.username,
                password_hash = EXCLUDED.password_hash,
                role = EXCLUDED.role,
                is_active = EXCLUDED.is_active
            RETURNING id;
        `, [adminId, 'admin', 'admin@docqr.local', adminPassword, 'admin', true]);

        const actualAdminId = adminResult.rows[0].id;
        console.log('✅ Admin user seeded: admin@docqr.local / admin123');

        // Seed Categories
        for (const cat of categories) {
            await db.query(`
                INSERT INTO document_categories (id, name, description, created_by, updated_by)
                VALUES ($1, $2, $3, $4, $4)
                ON CONFLICT (name) DO NOTHING;
            `, [uuidv4(), cat.name, cat.description, actualAdminId]);
        }
        console.log('✅ Default categories seeded');

        console.log('✨ Seeding completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Seeding failed:', error);
        process.exit(1);
    }
}

seed();

import { db } from '../config/database';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

export interface CreateUserDTO {
    username: string;
    email: string;
    password: string;
    role: 'admin' | 'user';
}

export interface UpdateUserDTO {
    username?: string;
    email?: string;
    password?: string;
    role?: 'admin' | 'user';
    isActive?: boolean;
}

export interface AuditLogFilter {
    userId?: string;
    action?: string;
    resourceType?: string;
    dateFrom?: Date;
    dateTo?: Date;
    page?: number;
    limit?: number;
}

export class AdminService {
    /**
     * Get all users
     */
    async getAllUsers(page: number = 1, limit: number = 20): Promise<{ users: any[]; total: number }> {
        const offset = (page - 1) * limit;

        const countResult = await db.query(`SELECT COUNT(*) as total FROM users`);
        const total = parseInt(countResult.rows[0].total);

        const result = await db.query(
            `SELECT id, username, email, role, is_active, created_at, updated_at
       FROM users
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
            [limit, offset]
        );

        return {
            users: result.rows,
            total,
        };
    }

    /**
     * Create a new user
     */
    async createUser(data: CreateUserDTO): Promise<any> {
        // Check if username already exists
        const existingUsername = await db.query(
            `SELECT id FROM users WHERE username = $1`,
            [data.username]
        );

        if (existingUsername.rows.length > 0) {
            throw new Error('Username already exists');
        }

        // Check if email already exists
        const existingEmail = await db.query(
            `SELECT id FROM users WHERE email = $1`,
            [data.email]
        );

        if (existingEmail.rows.length > 0) {
            throw new Error('Email already exists');
        }

        // Hash password
        const passwordHash = await bcrypt.hash(data.password, 10);

        // Create user
        const result = await db.query(
            `INSERT INTO users (id, username, email, password_hash, role, is_active)
             VALUES ($1, $2, $3, $4, $5, true)
             RETURNING id, username, email, role, is_active, created_at, updated_at`,
            [uuidv4(), data.username, data.email, passwordHash, data.role]
        );

        return result.rows[0];
    }

    /**
     * Get user by ID
     */
    async getUserById(id: string): Promise<any> {
        const result = await db.query(
            `SELECT id, username, email, role, is_active, created_at, updated_at
       FROM users
       WHERE id = $1`,
            [id]
        );

        if (result.rows.length === 0) {
            return null;
        }

        return result.rows[0];
    }

    /**
     * Update user
     */
    async updateUser(id: string, data: UpdateUserDTO): Promise<any> {
        const updates: string[] = [];
        const params: any[] = [];
        let paramIndex = 1;

        if (data.username !== undefined) {
            updates.push(`username = $${paramIndex}`);
            params.push(data.username);
            paramIndex++;
        }

        if (data.email !== undefined) {
            updates.push(`email = $${paramIndex}`);
            params.push(data.email);
            paramIndex++;
        }

        if (data.password !== undefined) {
            const passwordHash = await bcrypt.hash(data.password, 10);
            updates.push(`password_hash = $${paramIndex}`);
            params.push(passwordHash);
            paramIndex++;
        }

        if (data.role !== undefined) {
            updates.push(`role = $${paramIndex}`);
            params.push(data.role);
            paramIndex++;
        }

        if (data.isActive !== undefined) {
            updates.push(`is_active = $${paramIndex}`);
            params.push(data.isActive);
            paramIndex++;
        }

        params.push(id);

        if (updates.length > 0) {
            await db.query(
                `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
                params
            );
        }

        return await this.getUserById(id);
    }

    /**
     * Deactivate user
     */
    async deactivateUser(id: string): Promise<boolean> {
        const result = await db.query(
            `UPDATE users SET is_active = false WHERE id = $1`,
            [id]
        );

        return result.rowCount !== null && result.rowCount > 0;
    }

    /**
     * Get audit logs
     */
    async getAuditLogs(filter: AuditLogFilter): Promise<{ logs: any[]; total: number }> {
        const page = filter.page || 1;
        const limit = filter.limit || 50;
        const offset = (page - 1) * limit;

        let whereConditions: string[] = [];
        let queryParams: any[] = [];
        let paramIndex = 1;

        if (filter.userId) {
            whereConditions.push(`user_id = $${paramIndex}`);
            queryParams.push(filter.userId);
            paramIndex++;
        }

        if (filter.action) {
            whereConditions.push(`action = $${paramIndex}`);
            queryParams.push(filter.action);
            paramIndex++;
        }

        if (filter.resourceType) {
            whereConditions.push(`resource_type = $${paramIndex}`);
            queryParams.push(filter.resourceType);
            paramIndex++;
        }

        if (filter.dateFrom) {
            whereConditions.push(`created_at >= $${paramIndex}`);
            queryParams.push(filter.dateFrom);
            paramIndex++;
        }

        if (filter.dateTo) {
            whereConditions.push(`created_at <= $${paramIndex}`);
            queryParams.push(filter.dateTo);
            paramIndex++;
        }

        const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

        // Get total count
        const countResult = await db.query(
            `SELECT COUNT(*) as total FROM audit_logs ${whereClause}`,
            queryParams
        );
        const total = parseInt(countResult.rows[0].total);

        // Get logs
        const result = await db.query(
            `SELECT 
        al.*,
        u.username
       FROM audit_logs al
       LEFT JOIN users u ON al.user_id = u.id
       ${whereClause}
       ORDER BY al.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
            [...queryParams, limit, offset]
        );

        return {
            logs: result.rows,
            total,
        };
    }

    /**
     * Get system statistics
     */
    async getStatistics(): Promise<any> {
        const stats = await Promise.all([
            db.query(`SELECT COUNT(*) as total FROM users WHERE is_active = true`),
            db.query(`SELECT COUNT(*) as total FROM documents WHERE deleted_at IS NULL`),
            db.query(`SELECT COUNT(*) as total FROM document_categories`),
            db.query(`SELECT SUM(file_size) as total FROM documents WHERE deleted_at IS NULL`),
            db.query(`
        SELECT DATE(created_at) as date, COUNT(*) as count
        FROM documents
        WHERE created_at >= CURRENT_DATE - INTERVAL '30 days' AND deleted_at IS NULL
        GROUP BY DATE(created_at)
        ORDER BY date DESC
      `),
            db.query(`
        SELECT dc.name, COUNT(d.id) as count
        FROM document_categories dc
        LEFT JOIN documents d ON dc.id = d.category_id AND d.deleted_at IS NULL
        GROUP BY dc.id, dc.name
        ORDER BY count DESC
        LIMIT 10
      `),
        ]);

        return {
            totalUsers: parseInt(stats[0].rows[0].total),
            totalDocuments: parseInt(stats[1].rows[0].total),
            totalCategories: parseInt(stats[2].rows[0].total),
            totalStorageBytes: parseInt(stats[3].rows[0].total || 0),
            documentsPerDay: stats[4].rows,
            documentsByCategory: stats[5].rows,
        };
    }
}

export const adminService = new AdminService();

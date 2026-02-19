import { db } from '../config/database';
import { v4 as uuidv4 } from 'uuid';

export interface CreateCategoryDTO {
    name: string;
    description?: string;
    userId: string;
}

export interface UpdateCategoryDTO {
    name?: string;
    description?: string;
    userId: string;
}

export class CategoryService {
    /**
     * Create a new category
     */
    async createCategory(data: CreateCategoryDTO): Promise<any> {
        // Check if category already exists
        const existing = await db.query(
            `SELECT id FROM document_categories WHERE name = $1`,
            [data.name]
        );

        if (existing.rows.length > 0) {
            throw new Error('Category already exists');
        }

        const result = await db.query(
            `INSERT INTO document_categories (id, name, description, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
            [uuidv4(), data.name, data.description || null, data.userId, data.userId]
        );

        return result.rows[0];
    }

    /**
     * Get all categories
     */
    async getAllCategories(): Promise<any[]> {
        const result = await db.query(
            `SELECT 
        dc.*,
        u1.username as created_by_username,
        u2.username as updated_by_username,
        COUNT(d.id) as document_count
       FROM document_categories dc
       LEFT JOIN users u1 ON dc.created_by = u1.id
       LEFT JOIN users u2 ON dc.updated_by = u2.id
       LEFT JOIN documents d ON dc.id = d.category_id AND d.deleted_at IS NULL
       GROUP BY dc.id, u1.username, u2.username
       ORDER BY dc.name ASC`
        );

        return result.rows;
    }

    /**
     * Get category by ID
     */
    async getCategoryById(id: string): Promise<any> {
        const result = await db.query(
            `SELECT 
        dc.*,
        u1.username as created_by_username,
        u2.username as updated_by_username,
        COUNT(d.id) as document_count
       FROM document_categories dc
       LEFT JOIN users u1 ON dc.created_by = u1.id
       LEFT JOIN users u2 ON dc.updated_by = u2.id
       LEFT JOIN documents d ON dc.id = d.category_id AND d.deleted_at IS NULL
       WHERE dc.id = $1
       GROUP BY dc.id, u1.username, u2.username`,
            [id]
        );

        if (result.rows.length === 0) {
            return null;
        }

        return result.rows[0];
    }

    /**
     * Update category
     */
    async updateCategory(id: string, data: UpdateCategoryDTO): Promise<any> {
        const updates: string[] = [];
        const params: any[] = [];
        let paramIndex = 1;

        if (data.name !== undefined) {
            // Check if new name already exists
            const existing = await db.query(
                `SELECT id FROM document_categories WHERE name = $1 AND id != $2`,
                [data.name, id]
            );

            if (existing.rows.length > 0) {
                throw new Error('Category name already exists');
            }

            updates.push(`name = $${paramIndex}`);
            params.push(data.name);
            paramIndex++;
        }

        if (data.description !== undefined) {
            updates.push(`description = $${paramIndex}`);
            params.push(data.description);
            paramIndex++;
        }

        updates.push(`updated_by = $${paramIndex}`);
        params.push(data.userId);
        paramIndex++;

        params.push(id);

        if (updates.length > 0) {
            await db.query(
                `UPDATE document_categories SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
                params
            );
        }

        return await this.getCategoryById(id);
    }

    /**
     * Delete category
     */
    async deleteCategory(id: string): Promise<boolean> {
        // Check if category has documents
        const documents = await db.query(
            `SELECT COUNT(*) as count FROM documents WHERE category_id = $1 AND deleted_at IS NULL`,
            [id]
        );

        if (parseInt(documents.rows[0].count) > 0) {
            throw new Error('Cannot delete category with associated documents');
        }

        const result = await db.query(
            `DELETE FROM document_categories WHERE id = $1`,
            [id]
        );

        return result.rowCount !== null && result.rowCount > 0;
    }
}

export const categoryService = new CategoryService();

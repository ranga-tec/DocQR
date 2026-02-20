import { db } from '../config/database';
import { storageClient } from '../config/storage';
import { qrCodeService } from './qrcode.service';
import { config } from '../config';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';

export interface CreateDocumentDTO {
    title: string;
    description?: string;
    categoryId?: string;
    tags?: string[];
    file: Express.Multer.File;
    userId: string;
}

export interface UpdateDocumentDTO {
    title?: string;
    description?: string;
    categoryId?: string;
    tags?: string[];
    userId: string;
}

export interface DocumentFilter {
    search?: string;
    categoryId?: string;
    tags?: string[];
    createdBy?: string;
    dateFrom?: Date;
    dateTo?: Date;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'ASC' | 'DESC';
}

export class DocumentService {
    /**
     * Create a new document with QR code
     */
    async createDocument(data: CreateDocumentDTO): Promise<any> {
        console.log('📝 createDocument started', { title: data.title, fileSize: data.file.size, userId: data.userId });

        return await db.transaction(async (client) => {
            const documentId = uuidv4();
            const fileExtension = path.extname(data.file.originalname);
            const minioObjectKey = `${documentId}${fileExtension}`;

            // Upload file to storage
            try {
                console.log(`📂 Uploading file to ${config.minio.buckets.documents}/${minioObjectKey}...`);
                await storageClient.uploadFile(
                    config.minio.buckets.documents,
                    minioObjectKey,
                    data.file.buffer,
                    data.file.size,
                    {
                        'Content-Type': data.file.mimetype,
                        'Original-Name': data.file.originalname,
                    }
                );
            } catch (err: any) {
                throw new Error(`Storage upload failed: ${err.message}`);
            }

            // Generate QR code
            let qrBuffer, qrData;
            try {
                console.log('🔳 Generating QR code...');
                const qrResult = await qrCodeService.generateQRCode(documentId, data.title);
                qrBuffer = qrResult.buffer;
                qrData = qrResult.data;
            } catch (err: any) {
                throw new Error(`QR generation failed: ${err.message}`);
            }

            const qrObjectKey = `${documentId}.png`;

            // Upload QR code to storage
            try {
                console.log(`📂 Uploading QR to ${config.minio.buckets.qrCodes}/${qrObjectKey}...`);
                await storageClient.uploadFile(
                    config.minio.buckets.qrCodes,
                    qrObjectKey,
                    qrBuffer,
                    qrBuffer.length,
                    { 'Content-Type': 'image/png' }
                );
            } catch (err: any) {
                throw new Error(`QR storage upload failed: ${err.message}`);
            }

            // Insert document record
            try {
                console.log('💾 Inserting document record into DB...');
                await client.query(
                    `INSERT INTO documents 
             (id, title, description, category_id, file_name, file_size, mime_type, 
              minio_bucket, minio_object_key, qr_code_path, qr_code_data, created_by, updated_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
             RETURNING *`,
                    [
                        documentId,
                        data.title,
                        data.description || null,
                        data.categoryId || null,
                        data.file.originalname,
                        data.file.size,
                        data.file.mimetype,
                        config.minio.buckets.documents,
                        minioObjectKey,
                        qrObjectKey,
                        qrData,
                        data.userId,
                        data.userId,
                    ]
                );
            } catch (err: any) {
                throw new Error(`Database insert failed: ${err.message}`);
            }

            // Insert tags if provided
            if (data.tags && data.tags.length > 0) {
                try {
                    for (const tag of data.tags) {
                        await client.query(
                            `INSERT INTO document_tags (document_id, tag) VALUES ($1, $2)`,
                            [documentId, tag.trim().toLowerCase()]
                        );
                    }
                } catch (err: any) {
                    // Non-fatal? Maybe warnings. But let's fail for consistency.
                    throw new Error(`Tag insertion failed: ${err.message}`);
                }
            }

            console.log('✅ createDocument completed successfully');
            return await this.getDocumentById(documentId);
        });
    }

    /**
     * Get document by ID
     */
    async getDocumentById(id: string): Promise<any> {
        const result = await db.query(
            `SELECT 
        d.*,
        dc.name as category_name,
        u1.username as created_by_username,
        u2.username as updated_by_username,
        COALESCE(
          json_agg(
            DISTINCT dt.tag
          ) FILTER (WHERE dt.tag IS NOT NULL),
          '[]'
        ) as tags
       FROM documents d
       LEFT JOIN document_categories dc ON d.category_id = dc.id
       LEFT JOIN users u1 ON d.created_by = u1.id
       LEFT JOIN users u2 ON d.updated_by = u2.id
       LEFT JOIN document_tags dt ON d.id = dt.document_id
       WHERE d.id = $1 AND d.deleted_at IS NULL
       GROUP BY d.id, dc.name, u1.username, u2.username`,
            [id]
        );

        if (result.rows.length === 0) {
            return null;
        }

        return result.rows[0];
    }

    /**
     * Get document by QR code data
     */
    async getDocumentByQRCode(qrData: string): Promise<any> {
        const documentId = qrCodeService.validateQRCodeData(qrData);

        if (!documentId) {
            return null;
        }

        return await this.getDocumentById(documentId);
    }

    /**
     * List documents with filters and pagination
     */
    async listDocuments(filter: DocumentFilter): Promise<{ documents: any[]; total: number; page: number; limit: number }> {
        const page = filter.page || 1;
        const limit = filter.limit || 20;
        const offset = (page - 1) * limit;
        const sortBy = filter.sortBy || 'created_at';
        const sortOrder = filter.sortOrder || 'DESC';

        let whereConditions: string[] = ['d.deleted_at IS NULL'];
        let queryParams: any[] = [];
        let paramIndex = 1;

        // Search filter
        if (filter.search) {
            whereConditions.push(
                `(d.title ILIKE $${paramIndex} OR d.description ILIKE $${paramIndex})`
            );
            queryParams.push(`%${filter.search}%`);
            paramIndex++;
        }

        // Category filter
        if (filter.categoryId) {
            whereConditions.push(`d.category_id = $${paramIndex}`);
            queryParams.push(filter.categoryId);
            paramIndex++;
        }

        // Created by filter
        if (filter.createdBy) {
            whereConditions.push(`d.created_by = $${paramIndex}`);
            queryParams.push(filter.createdBy);
            paramIndex++;
        }

        // Date range filter
        if (filter.dateFrom) {
            whereConditions.push(`d.created_at >= $${paramIndex}`);
            queryParams.push(filter.dateFrom);
            paramIndex++;
        }

        if (filter.dateTo) {
            whereConditions.push(`d.created_at <= $${paramIndex}`);
            queryParams.push(filter.dateTo);
            paramIndex++;
        }

        // Tags filter
        if (filter.tags && filter.tags.length > 0) {
            whereConditions.push(
                `d.id IN (SELECT document_id FROM document_tags WHERE tag = ANY($${paramIndex}))`
            );
            queryParams.push(filter.tags);
            paramIndex++;
        }

        const whereClause = whereConditions.join(' AND ');

        // Get total count
        const countResult = await db.query(
            `SELECT COUNT(DISTINCT d.id) as total
       FROM documents d
       WHERE ${whereClause}`,
            queryParams
        );

        const total = parseInt(countResult.rows[0].total);

        // Get documents
        const result = await db.query(
            `SELECT 
        d.*,
        dc.name as category_name,
        u1.username as created_by_username,
        u2.username as updated_by_username,
        COALESCE(
          json_agg(
            DISTINCT dt.tag
          ) FILTER (WHERE dt.tag IS NOT NULL),
          '[]'
        ) as tags
       FROM documents d
       LEFT JOIN document_categories dc ON d.category_id = dc.id
       LEFT JOIN users u1 ON d.created_by = u1.id
       LEFT JOIN users u2 ON d.updated_by = u2.id
       LEFT JOIN document_tags dt ON d.id = dt.document_id
       WHERE ${whereClause}
       GROUP BY d.id, dc.name, u1.username, u2.username
       ORDER BY d.${sortBy} ${sortOrder}
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
            [...queryParams, limit, offset]
        );

        return {
            documents: result.rows,
            total,
            page,
            limit,
        };
    }

    /**
     * Update document
     */
    async updateDocument(id: string, data: UpdateDocumentDTO): Promise<any> {
        return await db.transaction(async (client) => {
            const updates: string[] = [];
            const params: any[] = [];
            let paramIndex = 1;

            if (data.title !== undefined) {
                updates.push(`title = $${paramIndex}`);
                params.push(data.title);
                paramIndex++;
            }

            if (data.description !== undefined) {
                updates.push(`description = $${paramIndex}`);
                params.push(data.description);
                paramIndex++;
            }

            if (data.categoryId !== undefined) {
                updates.push(`category_id = $${paramIndex}`);
                params.push(data.categoryId);
                paramIndex++;
            }

            updates.push(`updated_by = $${paramIndex}`);
            params.push(data.userId);
            paramIndex++;

            params.push(id);

            if (updates.length > 0) {
                await client.query(
                    `UPDATE documents SET ${updates.join(', ')} WHERE id = $${paramIndex} AND deleted_at IS NULL`,
                    params
                );
            }

            // Update tags if provided
            if (data.tags !== undefined) {
                // Delete existing tags
                await client.query(`DELETE FROM document_tags WHERE document_id = $1`, [id]);

                // Insert new tags
                if (data.tags.length > 0) {
                    for (const tag of data.tags) {
                        await client.query(
                            `INSERT INTO document_tags (document_id, tag) VALUES ($1, $2)`,
                            [id, tag.trim().toLowerCase()]
                        );
                    }
                }
            }

            return await this.getDocumentById(id);
        });
    }

    /**
     * Delete document (soft delete)
     */
    async deleteDocument(id: string): Promise<boolean> {
        const result = await db.query(
            `UPDATE documents SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1 AND deleted_at IS NULL`,
            [id]
        );

        return result.rowCount !== null && result.rowCount > 0;
    }

    /**
     * Permanently delete document and files
     */
    async permanentlyDeleteDocument(id: string): Promise<boolean> {
        const document = await db.query(
            `SELECT minio_bucket, minio_object_key, qr_code_path FROM documents WHERE id = $1`,
            [id]
        );

        if (document.rows.length === 0) {
            return false;
        }

        const doc = document.rows[0];

        // Delete from storage
        try {
            await storageClient.deleteFile(doc.minio_bucket, doc.minio_object_key);
            await storageClient.deleteFile(config.minio.buckets.qrCodes, doc.qr_code_path);
        } catch (error) {
            console.error('Error deleting files from storage:', error);
        }

        // Delete from database (cascade will delete tags)
        await db.query(`DELETE FROM documents WHERE id = $1`, [id]);

        return true;
    }

    /**
     * Get document download stream
     */
    async getDocumentStream(id: string): Promise<{ stream: NodeJS.ReadableStream; document: any } | null> {
        const document = await this.getDocumentById(id);

        if (!document) {
            return null;
        }

        const stream = await storageClient.getFile(document.minio_bucket, document.minio_object_key);

        return { stream, document };
    }

    /**
     * Get QR code stream
     */
    async getQRCodeStream(id: string): Promise<NodeJS.ReadableStream | null> {
        const document = await this.getDocumentById(id);

        if (!document) {
            return null;
        }

        return await storageClient.getFile(config.minio.buckets.qrCodes, document.qr_code_path);
    }
}

export const documentService = new DocumentService();

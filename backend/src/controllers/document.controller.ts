import { Response } from 'express';
import { documentService, StorageObjectNotFoundError } from '../services/document.service';
import { AuthRequest } from '../middleware/auth';

export class DocumentController {
    /**
     * Upload a new document
     */
    async uploadDocument(req: AuthRequest, res: Response): Promise<void> {
        try {
            if (!req.user) {
                res.status(401).json({ error: 'Unauthorized' });
                return;
            }

            if (!req.file) {
                res.status(400).json({ error: 'No file uploaded' });
                return;
            }

            const { title, description, categoryId, tags } = req.body;

            const document = await documentService.createDocument({
                title,
                description,
                categoryId: categoryId || undefined,
                tags: tags ? (Array.isArray(tags) ? tags : tags.split(',').map((t: string) => t.trim())) : undefined,
                file: req.file,
                userId: req.user.id,
            });

            res.status(201).json({
                message: 'Document uploaded successfully',
                document,
            });
        } catch (error: any) {
            console.error('Upload error:', error);
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * Get document by ID
     */
    async getDocument(req: AuthRequest, res: Response): Promise<void> {
        try {
            const { id } = req.params;

            const document = await documentService.getDocumentById(id);

            if (!document) {
                res.status(404).json({ error: 'Document not found' });
                return;
            }

            res.status(200).json({ document });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * Get document by QR code
     */
    async getDocumentByQRCode(req: AuthRequest, res: Response): Promise<void> {
        try {
            const { qrCode } = req.params;

            const document = await documentService.getDocumentByQRCode(decodeURIComponent(qrCode));

            if (!document) {
                res.status(404).json({ error: 'Document not found' });
                return;
            }

            res.status(200).json({ document });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * List all documents with filters
     */
    async listDocuments(req: AuthRequest, res: Response): Promise<void> {
        try {
            const {
                search,
                categoryId,
                tags,
                createdBy,
                dateFrom,
                dateTo,
                page,
                limit,
                sortBy,
                sortOrder,
            } = req.query;

            const result = await documentService.listDocuments({
                search: search as string,
                categoryId: categoryId as string,
                tags: tags ? (Array.isArray(tags) ? tags as string[] : (tags as string).split(',')) : undefined,
                createdBy: createdBy as string,
                dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
                dateTo: dateTo ? new Date(dateTo as string) : undefined,
                page: page ? parseInt(page as string) : undefined,
                limit: limit ? parseInt(limit as string) : undefined,
                sortBy: sortBy as string,
                sortOrder: (sortOrder as 'ASC' | 'DESC') || 'DESC',
            });

            res.status(200).json(result);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * Update document
     */
    async updateDocument(req: AuthRequest, res: Response): Promise<void> {
        try {
            if (!req.user) {
                res.status(401).json({ error: 'Unauthorized' });
                return;
            }

            const { id } = req.params;
            const { title, description, categoryId, tags } = req.body;

            const document = await documentService.updateDocument(id, {
                title,
                description,
                categoryId,
                tags: tags ? (Array.isArray(tags) ? tags : tags.split(',').map((t: string) => t.trim())) : undefined,
                userId: req.user.id,
            });

            if (!document) {
                res.status(404).json({ error: 'Document not found' });
                return;
            }

            res.status(200).json({
                message: 'Document updated successfully',
                document,
            });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * Delete document (soft delete)
     */
    async deleteDocument(req: AuthRequest, res: Response): Promise<void> {
        try {
            const { id } = req.params;

            const success = await documentService.deleteDocument(id);

            if (!success) {
                res.status(404).json({ error: 'Document not found' });
                return;
            }

            res.status(200).json({ message: 'Document deleted successfully' });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * Download document file
     */
    async downloadDocument(req: AuthRequest, res: Response): Promise<void> {
        try {
            const { id } = req.params;

            const result = await documentService.getDocumentStream(id);

            if (!result) {
                res.status(404).json({ error: 'Document not found' });
                return;
            }

            res.setHeader('Content-Type', result.document.mime_type);
            res.setHeader('Content-Disposition', `attachment; filename="${result.document.file_name}"`);
            res.setHeader('Content-Length', result.document.file_size);

            result.stream.pipe(res);
        } catch (error: any) {
            if (error instanceof StorageObjectNotFoundError) {
                res.status(404).json({
                    error: 'Document file is not available in storage. Please re-upload this document.',
                });
                return;
            }

            console.error('Download document error:', error);
            res.status(500).json({ error: 'Failed to download document' });
        }
    }

    /**
     * Download QR code
     */
    async downloadQRCode(req: AuthRequest, res: Response): Promise<void> {
        try {
            const { id } = req.params;

            const stream = await documentService.getQRCodeStream(id);

            if (!stream) {
                res.status(404).json({ error: 'QR code not found' });
                return;
            }

            res.setHeader('Content-Type', 'image/png');
            res.setHeader('Content-Disposition', `attachment; filename="qr-${id}.png"`);

            stream.pipe(res);
        } catch (error: any) {
            if (error instanceof StorageObjectNotFoundError) {
                res.status(404).json({
                    error: 'QR image is not available in storage. Re-generate this document QR.',
                });
                return;
            }

            console.error('Download QR error:', error);
            res.status(500).json({ error: 'Failed to download QR code' });
        }
    }
}

export const documentController = new DocumentController();

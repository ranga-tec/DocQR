import { Router } from 'express';
import { documentController } from '../controllers/document.controller';
import { authenticate } from '../middleware/auth';
import { upload, handleMulterError } from '../middleware/upload';
import { validate } from '../middleware/validate';
import { body, query } from 'express-validator';
import { auditLog } from '../middleware/audit';

const router = Router();

/**
 * @route   POST /api/documents
 * @desc    Upload a new document
 * @access  Private
 */
router.post(
    '/',
    authenticate,
    upload.single('file'),
    handleMulterError,
    validate([
        body('title').trim().notEmpty().withMessage('Title is required'),
        body('description').optional().trim(),
        body('categoryId').optional().isUUID().withMessage('Invalid category ID'),
    ]),
    auditLog('CREATE', 'DOCUMENT'),
    documentController.uploadDocument.bind(documentController)
);

/**
 * @route   GET /api/documents
 * @desc    List all documents with filters
 * @access  Private
 */
router.get(
    '/',
    authenticate,
    validate([
        query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
        query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be 1-100'),
        query('sortBy').optional().isIn(['created_at', 'updated_at', 'title', 'file_size']).withMessage('Invalid sort field'),
        query('sortOrder').optional().isIn(['ASC', 'DESC']).withMessage('Sort order must be ASC or DESC'),
    ]),
    documentController.listDocuments.bind(documentController)
);

/**
 * @route   GET /api/documents/:id
 * @desc    Get document by ID
 * @access  Private
 */
router.get(
    '/:id',
    authenticate,
    auditLog('VIEW', 'DOCUMENT'),
    documentController.getDocument.bind(documentController)
);

/**
 * @route   GET /api/documents/qr/:qrCode
 * @desc    Get document by QR code
 * @access  Private
 */
router.get(
    '/qr/:qrCode',
    authenticate,
    auditLog('VIEW', 'DOCUMENT'),
    documentController.getDocumentByQRCode.bind(documentController)
);

/**
 * @route   PUT /api/documents/:id
 * @desc    Update document
 * @access  Private
 */
router.put(
    '/:id',
    authenticate,
    validate([
        body('title').optional().trim().notEmpty().withMessage('Title cannot be empty'),
        body('description').optional().trim(),
        body('categoryId').optional().isUUID().withMessage('Invalid category ID'),
    ]),
    auditLog('UPDATE', 'DOCUMENT'),
    documentController.updateDocument.bind(documentController)
);

/**
 * @route   DELETE /api/documents/:id
 * @desc    Delete document
 * @access  Private
 */
router.delete(
    '/:id',
    authenticate,
    auditLog('DELETE', 'DOCUMENT'),
    documentController.deleteDocument.bind(documentController)
);

/**
 * @route   GET /api/documents/:id/download
 * @desc    Download document file
 * @access  Private
 */
router.get(
    '/:id/download',
    authenticate,
    auditLog('DOWNLOAD', 'DOCUMENT'),
    documentController.downloadDocument.bind(documentController)
);

/**
 * @route   GET /api/documents/:id/qr
 * @desc    Download QR code
 * @access  Private
 */
router.get(
    '/:id/qr',
    authenticate,
    documentController.downloadQRCode.bind(documentController)
);

export default router;

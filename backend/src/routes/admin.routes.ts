import { Router } from 'express';
import { adminController } from '../controllers/admin.controller';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { body, query } from 'express-validator';
import { auditLog } from '../middleware/audit';

const router = Router();

// All admin routes require authentication and admin role
router.use(authenticate);
router.use(authorize('admin'));

/**
 * @route   GET /api/admin/users
 * @desc    Get all users
 * @access  Private (Admin only)
 */
router.get(
    '/users',
    validate([
        query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
        query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be 1-100'),
    ]),
    adminController.getAllUsers.bind(adminController)
);

/**
 * @route   POST /api/admin/users
 * @desc    Create a new user
 * @access  Private (Admin only)
 */
router.post(
    '/users',
    validate([
        body('username').trim().notEmpty().withMessage('Username is required')
            .isLength({ min: 3, max: 50 }).withMessage('Username must be 3-50 characters'),
        body('email').isEmail().normalizeEmail().withMessage('Invalid email address'),
        body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
        body('role').optional().isIn(['admin', 'user']).withMessage('Invalid role'),
    ]),
    auditLog('CREATE', 'USER'),
    adminController.createUser.bind(adminController)
);

/**
 * @route   GET /api/admin/users/:id
 * @desc    Get user by ID
 * @access  Private (Admin only)
 */
router.get(
    '/users/:id',
    adminController.getUser.bind(adminController)
);

/**
 * @route   PUT /api/admin/users/:id
 * @desc    Update user
 * @access  Private (Admin only)
 */
router.put(
    '/users/:id',
    validate([
        body('username').optional().trim().isLength({ min: 3, max: 50 }).withMessage('Username must be 3-50 characters'),
        body('email').optional().isEmail().normalizeEmail().withMessage('Invalid email address'),
        body('password').optional().isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
        body('role').optional().isIn(['admin', 'user']).withMessage('Invalid role'),
        body('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
    ]),
    auditLog('UPDATE', 'USER'),
    adminController.updateUser.bind(adminController)
);

/**
 * @route   DELETE /api/admin/users/:id
 * @desc    Deactivate user
 * @access  Private (Admin only)
 */
router.delete(
    '/users/:id',
    auditLog('DELETE', 'USER'),
    adminController.deactivateUser.bind(adminController)
);

/**
 * @route   GET /api/admin/audit-logs
 * @desc    Get audit logs
 * @access  Private (Admin only)
 */
router.get(
    '/audit-logs',
    validate([
        query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
        query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be 1-100'),
    ]),
    adminController.getAuditLogs.bind(adminController)
);

/**
 * @route   GET /api/admin/statistics
 * @desc    Get system statistics
 * @access  Private (Admin only)
 */
router.get(
    '/statistics',
    adminController.getStatistics.bind(adminController)
);

export default router;

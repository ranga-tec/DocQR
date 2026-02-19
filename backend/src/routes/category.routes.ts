import { Router } from 'express';
import { categoryController } from '../controllers/category.controller';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { body } from 'express-validator';
import { auditLog } from '../middleware/audit';

const router = Router();

/**
 * @route   POST /api/categories
 * @desc    Create a new category
 * @access  Private (Admin only)
 */
router.post(
    '/',
    authenticate,
    authorize('admin'),
    validate([
        body('name').trim().notEmpty().withMessage('Category name is required'),
        body('description').optional().trim(),
    ]),
    auditLog('CREATE', 'CATEGORY'),
    categoryController.createCategory.bind(categoryController)
);

/**
 * @route   GET /api/categories
 * @desc    Get all categories
 * @access  Private
 */
router.get(
    '/',
    authenticate,
    categoryController.getAllCategories.bind(categoryController)
);

/**
 * @route   GET /api/categories/:id
 * @desc    Get category by ID
 * @access  Private
 */
router.get(
    '/:id',
    authenticate,
    categoryController.getCategory.bind(categoryController)
);

/**
 * @route   PUT /api/categories/:id
 * @desc    Update category
 * @access  Private (Admin only)
 */
router.put(
    '/:id',
    authenticate,
    authorize('admin'),
    validate([
        body('name').optional().trim().notEmpty().withMessage('Category name cannot be empty'),
        body('description').optional().trim(),
    ]),
    auditLog('UPDATE', 'CATEGORY'),
    categoryController.updateCategory.bind(categoryController)
);

/**
 * @route   DELETE /api/categories/:id
 * @desc    Delete category
 * @access  Private (Admin only)
 */
router.delete(
    '/:id',
    authenticate,
    authorize('admin'),
    auditLog('DELETE', 'CATEGORY'),
    categoryController.deleteCategory.bind(categoryController)
);

export default router;

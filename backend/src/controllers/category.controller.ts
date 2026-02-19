import { Response } from 'express';
import { categoryService } from '../services/category.service';
import { AuthRequest } from '../middleware/auth';

export class CategoryController {
    /**
     * Create a new category
     */
    async createCategory(req: AuthRequest, res: Response): Promise<void> {
        try {
            if (!req.user) {
                res.status(401).json({ error: 'Unauthorized' });
                return;
            }

            const { name, description } = req.body;

            const category = await categoryService.createCategory({
                name,
                description,
                userId: req.user.id,
            });

            res.status(201).json({
                message: 'Category created successfully',
                category,
            });
        } catch (error: any) {
            res.status(400).json({ error: error.message });
        }
    }

    /**
     * Get all categories
     */
    async getAllCategories(_req: AuthRequest, res: Response): Promise<void> {
        try {
            const categories = await categoryService.getAllCategories();

            res.status(200).json({ categories });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * Get category by ID
     */
    async getCategory(req: AuthRequest, res: Response): Promise<void> {
        try {
            const { id } = req.params;

            const category = await categoryService.getCategoryById(id);

            if (!category) {
                res.status(404).json({ error: 'Category not found' });
                return;
            }

            res.status(200).json({ category });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * Update category
     */
    async updateCategory(req: AuthRequest, res: Response): Promise<void> {
        try {
            if (!req.user) {
                res.status(401).json({ error: 'Unauthorized' });
                return;
            }

            const { id } = req.params;
            const { name, description } = req.body;

            const category = await categoryService.updateCategory(id, {
                name,
                description,
                userId: req.user.id,
            });

            if (!category) {
                res.status(404).json({ error: 'Category not found' });
                return;
            }

            res.status(200).json({
                message: 'Category updated successfully',
                category,
            });
        } catch (error: any) {
            res.status(400).json({ error: error.message });
        }
    }

    /**
     * Delete category
     */
    async deleteCategory(req: AuthRequest, res: Response): Promise<void> {
        try {
            const { id } = req.params;

            const success = await categoryService.deleteCategory(id);

            if (!success) {
                res.status(404).json({ error: 'Category not found' });
                return;
            }

            res.status(200).json({ message: 'Category deleted successfully' });
        } catch (error: any) {
            res.status(400).json({ error: error.message });
        }
    }
}

export const categoryController = new CategoryController();

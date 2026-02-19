import { Response } from 'express';
import { adminService } from '../services/admin.service';
import { AuthRequest } from '../middleware/auth';

export class AdminController {
    /**
     * Get all users
     */
    async getAllUsers(req: AuthRequest, res: Response): Promise<void> {
        try {
            const page = req.query.page ? parseInt(req.query.page as string) : 1;
            const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;

            const result = await adminService.getAllUsers(page, limit);

            res.status(200).json(result);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * Create a new user
     */
    async createUser(req: AuthRequest, res: Response): Promise<void> {
        try {
            const { username, email, password, role } = req.body;

            const user = await adminService.createUser({
                username,
                email,
                password,
                role: role || 'user',
            });

            res.status(201).json({
                message: 'User created successfully',
                user,
            });
        } catch (error: any) {
            res.status(400).json({ error: error.message });
        }
    }

    /**
     * Get user by ID
     */
    async getUser(req: AuthRequest, res: Response): Promise<void> {
        try {
            const { id } = req.params;

            const user = await adminService.getUserById(id);

            if (!user) {
                res.status(404).json({ error: 'User not found' });
                return;
            }

            res.status(200).json({ user });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * Update user
     */
    async updateUser(req: AuthRequest, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const { username, email, password, role, isActive } = req.body;

            const user = await adminService.updateUser(id, {
                username,
                email,
                password,
                role,
                isActive,
            });

            if (!user) {
                res.status(404).json({ error: 'User not found' });
                return;
            }

            res.status(200).json({
                message: 'User updated successfully',
                user,
            });
        } catch (error: any) {
            res.status(400).json({ error: error.message });
        }
    }

    /**
     * Deactivate user
     */
    async deactivateUser(req: AuthRequest, res: Response): Promise<void> {
        try {
            const { id } = req.params;

            const success = await adminService.deactivateUser(id);

            if (!success) {
                res.status(404).json({ error: 'User not found' });
                return;
            }

            res.status(200).json({ message: 'User deactivated successfully' });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * Get audit logs
     */
    async getAuditLogs(req: AuthRequest, res: Response): Promise<void> {
        try {
            const {
                userId,
                action,
                resourceType,
                dateFrom,
                dateTo,
                page,
                limit,
            } = req.query;

            const result = await adminService.getAuditLogs({
                userId: userId as string,
                action: action as string,
                resourceType: resourceType as string,
                dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
                dateTo: dateTo ? new Date(dateTo as string) : undefined,
                page: page ? parseInt(page as string) : undefined,
                limit: limit ? parseInt(limit as string) : undefined,
            });

            res.status(200).json(result);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * Get system statistics
     */
    async getStatistics(_req: AuthRequest, res: Response): Promise<void> {
        try {
            const statistics = await adminService.getStatistics();

            res.status(200).json({ statistics });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }
}

export const adminController = new AdminController();

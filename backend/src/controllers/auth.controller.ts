import { Request, Response } from 'express';
import { authService } from '../services/auth.service';
import { AuthRequest } from '../middleware/auth';

export class AuthController {
    /**
     * @swagger
     * /auth/register:
     *   post:
     *     summary: Register a new user
     *     tags: [Auth]
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - username
     *               - email
     *               - password
     *             properties:
     *               username:
     *                 type: string
     *               email:
     *                 type: string
     *               password:
     *                 type: string
     *               role:
     *                 type: string
     *                 enum: [user, admin]
     *     responses:
     *       201:
     *         description: User created successfully
     *       400:
     *         description: Bad request
     */
    async register(req: Request, res: Response): Promise<void> {
        try {
            const { username, email, password, role } = req.body;

            const result = await authService.register({
                username,
                email,
                password,
                role,
            });

            res.status(201).json({
                message: 'User registered successfully',
                user: result.user,
                token: result.token,
            });
        } catch (error: any) {
            res.status(400).json({ error: error.message });
        }
    }

    /**
     * @swagger
     * /auth/login:
     *   post:
     *     summary: Login user
     *     tags: [Auth]
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               username:
     *                 type: string
     *               password:
     *                 type: string
     *     responses:
     *       200:
     *         description: Login successful
     */
    async login(req: Request, res: Response): Promise<void> {
        console.log('Login request received for:', req.body?.username);
        console.log('Request Headers:', JSON.stringify(req.headers));

        try {
            const { username, password } = req.body;

            if (!username || !password) {
                console.log('Missing credentials in body:', req.body);
                throw new Error('Username and password are required');
            }

            const result = await authService.login({ username, password });
            console.log('Login successful for:', username);

            res.status(200).json({
                message: 'Login successful',
                user: result.user,
                token: result.token,
            });
        } catch (error: any) {
            console.error('Login error in controller:', error);

            // Safe error serialization
            const errorObj = {
                message: error.message || 'Unknown error',
                stack: error.stack,
                name: error.name
            };

            res.status(401).json({
                error: errorObj,
                debug_body: req.body,
                debug_env: process.env.NODE_ENV
            });
        }
    }

    /**
     * Get current user
     */
    async me(req: AuthRequest, res: Response): Promise<void> {
        try {
            if (!req.user) {
                res.status(401).json({ error: 'Unauthorized' });
                return;
            }

            const user = await authService.getUserById(req.user.id);

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
     * Logout user (client-side token removal)
     */
    async logout(_req: Request, res: Response): Promise<void> {
        res.status(200).json({ message: 'Logged out successfully' });
    }
}

export const authController = new AuthController();

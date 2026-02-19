import { db } from '../config/database';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { v4 as uuidv4 } from 'uuid';

export interface RegisterDTO {
    username: string;
    email: string;
    password: string;
    role?: 'admin' | 'user';
}

export interface LoginDTO {
    username: string;
    password: string;
}

export class AuthService {
    /**
     * Register a new user
     */
    async register(data: RegisterDTO): Promise<{ user: any; token: string }> {
        // Check if user already exists
        const existingUser = await db.query(
            `SELECT id FROM users WHERE username = $1 OR email = $2`,
            [data.username, data.email]
        );

        if (existingUser.rows.length > 0) {
            throw new Error('Username or email already exists');
        }

        // Hash password
        const passwordHash = await bcrypt.hash(data.password, 10);

        // Insert user
        const result = await db.query(
            `INSERT INTO users (id, username, email, password_hash, role)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, username, email, role, created_at`,
            [uuidv4(), data.username, data.email, passwordHash, data.role || 'user']
        );

        const user = result.rows[0];

        // Generate token
        const token = this.generateToken(user);

        return { user, token };
    }

    /**
     * Login user
     */
    async login(data: LoginDTO): Promise<{ user: any; token: string }> {
        console.log('AuthService: Finding user:', data.username);
        // Find user
        const result = await db.query(
            `SELECT id, username, email, password_hash, role, is_active
       FROM users
       WHERE username = $1 OR email = $1`,
            [data.username]
        );

        console.log('AuthService: User found:', result.rows.length > 0);

        if (result.rows.length === 0) {
            throw new Error('Invalid credentials');
        }

        const user = result.rows[0];

        // Check if user is active
        if (!user.is_active) {
            throw new Error('Account is deactivated');
        }

        console.log('AuthService: Verifying password...');
        // Verify password
        const isValidPassword = await bcrypt.compare(data.password, user.password_hash);
        console.log('AuthService: Password valid:', isValidPassword);

        if (!isValidPassword) {
            throw new Error('Invalid credentials');
        }

        // Remove password hash from response
        delete user.password_hash;

        // Generate token
        console.log('AuthService: Generating token...');
        const token = this.generateToken(user);

        return { user, token };
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
     * Generate JWT token
     */
    private generateToken(user: any): string {
        return (jwt.sign as any)(
            {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role,
            },
            config.jwt.secret,
            { expiresIn: config.jwt.expiresIn }
        );
    }

    /**
     * Verify token
     */
    verifyToken(token: string): any {
        try {
            return jwt.verify(token, config.jwt.secret);
        } catch (error) {
            throw new Error('Invalid token');
        }
    }
}

export const authService = new AuthService();

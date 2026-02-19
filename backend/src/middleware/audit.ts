import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { db } from '../config/database';

export const auditLog = (action: string, resourceType: string) => {
    return async (req: AuthRequest, res: Response, next: NextFunction) => {
        const originalSend = res.send;

        res.send = function (data: any): Response {
            res.send = originalSend;

            // Only log successful operations (2xx status codes)
            if (res.statusCode >= 200 && res.statusCode < 300) {
                const resourceId = req.params.id || null;
                const userId = req.user?.id || null;
                const ipAddress = req.ip || req.socket.remoteAddress || null;
                const userAgent = req.get('user-agent') || null;

                const details = {
                    method: req.method,
                    path: req.path,
                    query: req.query,
                    body: sanitizeBody(req.body),
                };

                // Log asynchronously without blocking the response
                db.query(
                    `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details, ip_address, user_agent)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                    [userId, action, resourceType, resourceId, JSON.stringify(details), ipAddress, userAgent]
                ).catch(err => {
                    console.error('Error logging audit:', err);
                });
            }

            return originalSend.call(this, data);
        };

        next();
    };
};

function sanitizeBody(body: any): any {
    if (!body) return {};

    const sanitized = { ...body };

    // Remove sensitive fields
    const sensitiveFields = ['password', 'password_hash', 'token', 'secret'];
    sensitiveFields.forEach(field => {
        if (sanitized[field]) {
            sanitized[field] = '[REDACTED]';
        }
    });

    return sanitized;
}

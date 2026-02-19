import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { config } from '../config';
import path from 'path';

const storage = multer.memoryStorage();

const fileFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const ext = path.extname(file.originalname).toLowerCase().substring(1);

    if (config.upload.allowedFileTypes.includes(ext)) {
        cb(null, true);
    } else {
        cb(new Error(`File type not allowed. Allowed types: ${config.upload.allowedFileTypes.join(', ')}`));
    }
};

export const upload = multer({
    storage,
    limits: {
        fileSize: config.upload.maxFileSize,
    },
    fileFilter,
});

export const handleMulterError = (err: any, _req: Request, res: Response, next: NextFunction): void => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            res.status(400).json({
                error: 'File too large',
                maxSize: `${config.upload.maxFileSize / 1024 / 1024}MB`,
            });
            return;
        }
        res.status(400).json({ error: err.message });
        return;
    }

    if (err) {
        res.status(400).json({ error: err.message });
        return;
    }

    next();
};

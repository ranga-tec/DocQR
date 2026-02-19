import QRCode from 'qrcode';
import { config } from '../config';

export class QRCodeService {
    /**
     * Generate QR code for a document
     * @param documentId - The document UUID
     * @returns Buffer containing the QR code image and the data encoded
     */
    async generateQRCode(documentId: string): Promise<{ buffer: Buffer; data: string }> {
        try {
            // Create the QR code data - URL to view the document
            const qrData = `${config.qrCode.appBaseUrl}/document/${documentId}`;

            // Generate QR code as buffer
            const buffer = await QRCode.toBuffer(qrData, {
                errorCorrectionLevel: config.qrCode.errorCorrectionLevel,
                type: 'png',
                width: config.qrCode.size,
                margin: 2,
                color: {
                    dark: '#000000',
                    light: '#FFFFFF',
                },
            });

            return {
                buffer,
                data: qrData,
            };
        } catch (error) {
            console.error('Error generating QR code:', error);
            throw new Error('Failed to generate QR code');
        }
    }

    /**
     * Generate QR code as Data URL (base64)
     * @param documentId - The document UUID
     * @returns Data URL string
     */
    async generateQRCodeDataURL(documentId: string): Promise<string> {
        try {
            const qrData = `${config.qrCode.appBaseUrl}/document/${documentId}`;

            const dataURL = await QRCode.toDataURL(qrData, {
                errorCorrectionLevel: config.qrCode.errorCorrectionLevel,
                width: config.qrCode.size,
                margin: 2,
            });

            return dataURL;
        } catch (error) {
            console.error('Error generating QR code data URL:', error);
            throw new Error('Failed to generate QR code');
        }
    }

    /**
     * Validate QR code data
     * @param data - The QR code data to validate
     * @returns Document ID if valid, null otherwise
     */
    validateQRCodeData(data: string): string | null {
        try {
            const url = new URL(data);
            const pathParts = url.pathname.split('/');

            // Expected format: /document/{uuid}
            if (pathParts.length >= 3 && pathParts[1] === 'document') {
                const documentId = pathParts[2];

                // Validate UUID format
                const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
                if (uuidRegex.test(documentId)) {
                    return documentId;
                }
            }

            return null;
        } catch (error) {
            return null;
        }
    }
}

export const qrCodeService = new QRCodeService();

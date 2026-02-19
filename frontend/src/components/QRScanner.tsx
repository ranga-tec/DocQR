import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { documentService, Document } from "@/services/document.service";
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, QrCode, RefreshCw, AlertCircle, CheckCircle2, Eye, Camera, Image as ImageIcon, X } from "lucide-react";
import { format } from "date-fns";

/**
 * Extract document ID from QR code data
 * QR code can contain:
 * - Full URL: http://localhost:5173/document/{uuid}
 * - Just the UUID: {uuid}
 */
function extractDocumentId(qrData: string): string | null {
    // UUID regex pattern
    const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

    // First, try to extract UUID from URL
    try {
        const url = new URL(qrData);
        const pathParts = url.pathname.split('/');

        // Look for /document/{uuid} pattern
        const documentIndex = pathParts.indexOf('document');
        if (documentIndex !== -1 && pathParts[documentIndex + 1]) {
            const potentialId = pathParts[documentIndex + 1];
            if (uuidPattern.test(potentialId)) {
                return potentialId;
            }
        }

        // Check if any path part is a UUID
        for (const part of pathParts) {
            if (uuidPattern.test(part)) {
                return part;
            }
        }
    } catch {
        // Not a valid URL, check if it's a direct UUID
    }

    // Check if the entire string is a UUID
    const match = qrData.match(uuidPattern);
    if (match) {
        return match[0];
    }

    return null;
}

export function QRScanner() {
    const [scanResult, setScanResult] = useState<Document | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [scanning, setScanning] = useState(false);

    // "camera" or "file" mode for UI
    const [mode, setMode] = useState<'idle' | 'camera' | 'file'>('idle');

    const scannerRef = useRef<Html5Qrcode | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        // Cleanup on unmount
        return () => {
            if (scannerRef.current && scannerRef.current.isScanning) {
                scannerRef.current.stop().catch(console.error);
            }
        };
    }, []);

    const handleScanSuccess = async (decodedText: string) => {
        if (scannerRef.current && scannerRef.current.isScanning) {
            await scannerRef.current.stop();
        }
        setScanning(false);
        setMode('idle');
        setIsLoading(true);
        setError(null);

        console.log(`QR Code scanned: ${decodedText}`);
        const documentId = extractDocumentId(decodedText);

        if (!documentId) {
            setError("Invalid QR code format. Expected a document QR code.");
            setIsLoading(false);
            return;
        }

        try {
            const doc = await documentService.getById(documentId);
            setScanResult(doc);
        } catch (err: any) {
            console.error("Document not found", err);
            setError(err.response?.data?.error || "Document not found or access denied.");
        } finally {
            setIsLoading(false);
        }
    };

    const startCamera = async () => {
        setError(null);
        setScanResult(null);
        setMode('camera');
        setScanning(true);

        try {
            if (!scannerRef.current) {
                scannerRef.current = new Html5Qrcode("reader-custom");
            }

            await scannerRef.current.start(
                { facingMode: "environment" },
                {
                    fps: 10,
                    qrbox: { width: 250, height: 250 },
                },
                handleScanSuccess,
                () => { } // Ignore failures
            );
        } catch (err) {
            console.error("Failed to start camera", err);
            setError("Failed to access camera. Please ensure you have granted permissions.");
            setScanning(false);
            setMode('idle');
        }
    };

    const stopCamera = async () => {
        if (scannerRef.current && scanning) {
            try {
                await scannerRef.current.stop();
                setScanning(false);
                setMode('idle');
            } catch (err) {
                console.error("Failed to stop camera", err);
            }
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setError(null);
        setScanResult(null);
        setMode('file');
        setIsLoading(true);

        if (!scannerRef.current) {
            scannerRef.current = new Html5Qrcode("reader-custom");
        }

        scannerRef.current.scanFileV2(file, true)
            .then(decodedResult => {
                handleScanSuccess(decodedResult.decodedText);
            })
            .catch(err => {
                console.error("File scan failed", err);
                setError("No QR code found in this image.");
                setIsLoading(false);
                setMode('idle');
            });

        // Reset input
        e.target.value = '';
    };

    const resetScan = () => {
        setScanResult(null);
        setError(null);
        setIsLoading(false);
        setMode('idle');
    };

    return (
        <div className="flex flex-col items-center justify-center gap-8 w-full max-w-md mx-auto">
            {/* Initial Selection UI */}
            {!scanResult && !isLoading && mode === 'idle' && !error && (
                <Card className="w-full">
                    <CardContent className="pt-6 flex flex-col gap-4">
                        <Button size="lg" className="h-24 text-lg" onClick={startCamera}>
                            <Camera className="h-8 w-8 mr-4" />
                            Scan with Camera
                        </Button>
                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <span className="w-full border-t" />
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                                <span className="bg-background px-2 text-muted-foreground">Or</span>
                            </div>
                        </div>
                        <Button variant="outline" size="lg" className="h-24 text-lg" onClick={() => fileInputRef.current?.click()}>
                            <ImageIcon className="h-8 w-8 mr-4" />
                            Upload Image
                        </Button>
                        <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            ref={fileInputRef}
                            onChange={handleFileUpload}
                        />
                    </CardContent>
                </Card>
            )}

            {/* Camera View */}
            <div className={mode === 'camera' ? 'block w-full' : 'hidden'}>
                <div className="relative">
                    <div id="reader-custom" className="w-[300px] h-[300px] border-2 border-primary rounded-xl overflow-hidden shadow-lg mx-auto bg-black"></div>

                    {/* Only show overlay when actually scanning with camera */}
                    {scanning && (
                        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                            <div className="w-48 h-48 border-2 border-primary/50 rounded-lg animate-pulse shadow-[0_0_0_1000px_rgba(0,0,0,0.5)]"></div>
                        </div>
                    )}

                    <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 right-2 text-white hover:bg-white/20 z-10"
                        onClick={stopCamera}
                    >
                        <X className="h-6 w-6" />
                    </Button>
                </div>
                <p className="text-center text-sm text-muted-foreground mt-4 animate-pulse">
                    Scanning...
                </p>
                <div className="text-center mt-4">
                    <Button variant="outline" onClick={stopCamera}>Cancel Scan</Button>
                </div>
            </div>

            {/* Loading State */}
            {isLoading && (
                <Card className="w-full shadow-xl">
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <RefreshCw className="h-10 w-10 text-primary animate-spin mb-4" />
                        <p className="text-muted-foreground">Processing QR Code...</p>
                    </CardContent>
                </Card>
            )}

            {/* Error State */}
            {error && !isLoading && (
                <Card className="w-full shadow-xl border-destructive/20">
                    <CardHeader className="pb-3">
                        <div className="flex items-center gap-3">
                            <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
                                <AlertCircle className="h-6 w-6 text-destructive" />
                            </div>
                            <div>
                                <CardTitle className="text-destructive">Scan Error</CardTitle>
                                <CardDescription>{error}</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <Button onClick={resetScan} className="w-full">
                            <RefreshCw className="h-4 w-4 mr-2" /> Try Again
                        </Button>
                    </CardContent>
                </Card>
            )}

            {/* Success State */}
            {scanResult && !isLoading && (
                <Card className="w-full shadow-xl border-green-500/20">
                    <CardHeader className="pb-3">
                        <div className="flex items-center gap-3">
                            <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                                <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <CardTitle className="truncate">{scanResult.title}</CardTitle>
                                <CardDescription className="truncate">
                                    {scanResult.description || "No description"}
                                </CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* Document Details */}
                        <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">File</span>
                                <span className="font-medium truncate max-w-[180px]">{scanResult.file_name}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Size</span>
                                <span className="font-medium">{(scanResult.file_size / 1024 / 1024).toFixed(2)} MB</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Category</span>
                                <span className="font-medium">{scanResult.category_name || "Uncategorized"}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Created</span>
                                <span className="font-medium">{format(new Date(scanResult.created_at), "MMM d, yyyy")}</span>
                            </div>
                            {scanResult.created_by_username && (
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">By</span>
                                    <span className="font-medium">{scanResult.created_by_username}</span>
                                </div>
                            )}
                            {scanResult.tags && scanResult.tags.length > 0 && (
                                <div className="flex justify-between text-sm items-start">
                                    <span className="text-muted-foreground">Tags</span>
                                    <div className="flex flex-wrap gap-1 justify-end max-w-[180px]">
                                        {scanResult.tags.map((tag: string, idx: number) => (
                                            <span key={idx} className="px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col gap-2">
                            <Button
                                onClick={() => documentService.view(scanResult.id)}
                                className="w-full"
                                variant="default"
                            >
                                <Eye className="h-4 w-4 mr-2" /> View Document
                            </Button>

                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    onClick={() => documentService.download(scanResult.id, scanResult.file_name)}
                                    className="flex-1"
                                >
                                    <Download className="h-4 w-4 mr-2" /> Download
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={resetScan}
                                    className="flex-1"
                                >
                                    <QrCode className="h-4 w-4 mr-2" /> Scan Another
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

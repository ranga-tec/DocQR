import { QRScanner } from "@/components/QRScanner";

export function QRScannerPage() {
    return (
        <div className="space-y-6 container mx-auto p-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Scan QR Code</h1>
                    <p className="text-muted-foreground">Access physical documents instantly.</p>
                </div>
            </div>

            <div className="flex justify-center py-12">
                <QRScanner />
            </div>
        </div>
    );
}

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Printer, CheckCircle, AlertCircle, Info } from "lucide-react";

interface ScannerInterfaceProps {
    onScanComplete: (file: File) => void;
    onCancel: () => void;
}

// Hardware Service Configuration
const SCANNER_BRIDGE_URL = "/scan-service";

export function ScannerInterface({ onScanComplete, onCancel }: ScannerInterfaceProps) {
    const [status, setStatus] = useState<"idle" | "searching" | "ready" | "scanning" | "processing" | "done" | "error">("searching");

    // Devices list
    const [devices, setDevices] = useState<{ id: string, name: string }[]>([]);

    // Selection & Settings
    const [selectedScanner, setSelectedScanner] = useState<string>("");
    const [dpi, setDpi] = useState("300");
    const [colorMode, setColorMode] = useState("color");

    // UI State
    const [scannedImage, setScannedImage] = useState<string | null>(null);
    const [_error, setError] = useState<string | null>(null);

    // Initial Load
    useEffect(() => {
        // Load settings
        const savedDpi = localStorage.getItem("docqr_scanner_dpi");
        if (savedDpi) setDpi(savedDpi);

        const savedColor = localStorage.getItem("docqr_scanner_color");
        if (savedColor) setColorMode(savedColor);

        // Trigger discovery
        discoverScanners();
    }, []);

    const discoverScanners = async () => {
        setStatus("searching");
        setError(null);
        setDevices([]);
        setSelectedScanner("");

        try {
            // Fetch from /scan-service/api/config (or /devices depending on scanservjs version)
            const response = await fetch(`${SCANNER_BRIDGE_URL}/api/config`);

            if (!response.ok) {
                // Try port 8080 directly if proxy fails? (Cannot do from browser due to CORS usually, unless configured)
                // But vite proxy is setup.
                throw new Error(`Bridge Service Unreachable (${response.status})`);
            }

            const data = await response.json();

            // Adapt response to our format (scanservjs usually returns { devices: [...] })
            const realDevices = (data.devices || []).map((d: any) => ({
                id: d.id || d.name,
                name: d.name || d.id
            }));

            if (realDevices.length === 0) {
                setError("No scanners detected. Check USB/Network connection.");
                setStatus("idle");
            } else {
                setDevices(realDevices);
                setSelectedScanner(realDevices[0].id);
                // Auto-select first one
                handleScannerChange(realDevices[0].id);
                setStatus("ready");
            }

        } catch (err: any) {
            console.error("Scanner Bridge Error:", err);
            setError("Scanner Service not detected.");
            setStatus("error");
        }
    };

    const handleScannerChange = (value: string) => {
        setSelectedScanner(value);
        localStorage.setItem("docqr_scanner_id", value);
    };

    const handleDpiChange = (value: string) => {
        setDpi(value);
        localStorage.setItem("docqr_scanner_dpi", value);
    };

    const handleColorModeChange = (value: string) => {
        setColorMode(value);
        localStorage.setItem("docqr_scanner_color", value);
    };

    const startScan = async () => {
        setStatus("scanning");
        setError(null);

        try {
            // Post scan request
            const response = await fetch(`${SCANNER_BRIDGE_URL}/api/scan`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    deviceId: selectedScanner,
                    resolution: parseInt(dpi),
                    mode: colorMode
                })
            });

            if (!response.ok) throw new Error("Scan failed to start");

            const blob = await response.blob();
            const imageUrl = URL.createObjectURL(blob);

            setStatus("done");
            setScannedImage(imageUrl);

        } catch (err: any) {
            console.error("Scan Failed:", err);
            setError(err.message || "Scanning failed");
            setStatus("error");
        }
    };

    const handleSave = async () => {
        if (!scannedImage) return;

        try {
            // Convert URL to File object
            const response = await fetch(scannedImage);
            const blob = await response.blob();
            const file = new File([blob], `Scanned_Doc_${new Date().getTime()}.jpg`, { type: "image/jpeg" });

            onScanComplete(file);
        } catch (err) {
            console.error("Failed to save scanned image", err);
        }
    };

    return (
        <div className="flex flex-col h-full bg-zinc-50 dark:bg-zinc-900 p-6 overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h3 className="text-xl font-bold flex items-center gap-2">
                        <Printer className="w-6 h-6 text-primary" />
                        Hardware Scanner
                    </h3>
                    <p className="text-sm text-muted-foreground">
                        Connect to physical scanner via local bridge
                    </p>
                </div>

                <div className="flex items-center gap-4">
                    {status === "ready" && (
                        <div className="flex items-center gap-2 text-sm text-green-600 bg-green-100 dark:bg-green-900/30 px-3 py-1 rounded-full">
                            <div className="w-2 h-2 rounded-full bg-green-600 animate-pulse" />
                            Device Ready
                        </div>
                    )}
                </div>
            </div>

            {/* Error State with Instructions */}
            {status === "error" && (
                <div className="flex-1 flex flex-col items-center justify-start space-y-4 text-center p-8 bg-white dark:bg-zinc-800 rounded-lg border shadow-sm">
                    <AlertCircle className="w-12 h-12 text-destructive" />
                    <h4 className="text-lg font-bold text-destructive">Scanner Service Not Found</h4>
                    <p className="text-muted-foreground max-w-md">
                        We could not connect to the local scanner service at <code>http://localhost:8080</code>.
                    </p>

                    <div className="w-full max-w-lg text-left mt-4 border rounded-lg p-4 bg-muted/30">
                        <details className="group">
                            <summary className="font-medium cursor-pointer list-none flex items-center gap-2 text-primary">
                                <Info className="h-4 w-4" />
                                How to Install Scanner Support
                            </summary>
                            <div className="mt-4 text-sm text-muted-foreground space-y-3 pl-6 border-l-2 ml-2">
                                <p>To use physical scanners, you must install <strong>ScanServJS</strong> on this computer.</p>
                                <ol className="list-decimal pl-5 space-y-2">
                                    <li>Install the scanner drivers for your OS.</li>
                                    <li>
                                        Install Node.js from <a href="https://nodejs.org" target="_blank" className="font-medium text-primary hover:underline">nodejs.org</a>.
                                    </li>
                                    <li>
                                        Open a terminal and install ScanServJS:
                                        <div className="bg-zinc-100 dark:bg-zinc-900 p-2 rounded mt-1 font-mono text-xs text-foreground">
                                            npm install -g scanservjs
                                        </div>
                                    </li>
                                    <li>
                                        Start the service:
                                        <div className="bg-zinc-100 dark:bg-zinc-900 p-2 rounded mt-1 font-mono text-xs text-foreground">
                                            scanservjs --port 8080
                                        </div>
                                    </li>
                                    <li>Ensure the service is running and reload this dialog.</li>
                                </ol>
                                <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded text-xs">
                                    <strong>Note:</strong> Windows users may need to use <strong>NAPS2</strong> console CLI wrapper or exact TWAIN drivers supported by SANE/WIA.
                                </div>
                            </div>
                        </details>
                    </div>

                    <div className="flex gap-4 mt-6">
                        <Button variant="outline" onClick={discoverScanners}>Retry Connection</Button>
                    </div>
                </div>
            )}

            {/* Searching State */}
            {status === "searching" && (
                <div className="flex-1 flex flex-col items-center justify-center space-y-4">
                    <Loader2 className="w-12 h-12 text-primary animate-spin" />
                    <p className="text-lg font-medium">Searching for hardware scanners...</p>
                    <p className="text-sm text-muted-foreground">Checking localhost:8080...</p>
                </div>
            )}

            {/* Main Interface */}
            {status !== "error" && status !== "searching" && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 h-full">
                    {/* Left Panel: Settings */}
                    <div className="col-span-1 space-y-6">
                        <div className="space-y-4 bg-white dark:bg-zinc-800 p-4 rounded-lg border shadow-sm">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Select Device</label>
                                <Select value={selectedScanner} onValueChange={handleScannerChange}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select Scanner" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {devices.map(s => (
                                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Resolution (DPI)</label>
                                <Select value={dpi} onValueChange={handleDpiChange}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="150">150 DPI (Fast)</SelectItem>
                                        <SelectItem value="300">300 DPI (Standard)</SelectItem>
                                        <SelectItem value="600">600 DPI (High Quality)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Color Mode</label>
                                <Select value={colorMode} onValueChange={handleColorModeChange}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="color">Full Color</SelectItem>
                                        <SelectItem value="gray">Grayscale</SelectItem>
                                        <SelectItem value="bw">Black & White</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="pt-4">
                                <Button
                                    className="w-full h-12 text-lg"
                                    onClick={startScan}
                                    disabled={status === "scanning" || status === "processing" || devices.length === 0}
                                >
                                    {status === "scanning" ? (
                                        <>
                                            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Scanning...
                                        </>
                                    ) : (
                                        <>
                                            <Printer className="mr-2 h-5 w-5" /> Start Scan
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Right Panel: Preview */}
                    <div className="col-span-1 md:col-span-2 bg-neutral-100 dark:bg-neutral-800 rounded-lg border-2 border-dashed border-neutral-300 dark:border-neutral-600 flex items-center justify-center relative overflow-hidden min-h-[400px]">
                        {scannedImage ? (
                            <img src={scannedImage} alt="Scanned Document" className="max-w-full max-h-full shadow-2xl object-contain" />
                        ) : (
                            <div className="text-center text-muted-foreground">
                                <Printer className="w-16 h-16 mx-auto mb-4 opacity-20" />
                                <p>Preview will appear here</p>
                            </div>
                        )}

                        {status === "scanning" && (
                            <div className="absolute inset-0 bg-black/50 z-10 flex flex-col items-center justify-center text-white">
                                <div className="w-64 space-y-4 flex flex-col items-center">
                                    <p className="text-center font-medium">Acquiring Image...</p>
                                    <Loader2 className="h-10 w-10 animate-spin" />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <div className="flex justify-between mt-6 pt-6 border-t">
                <Button variant="ghost" onClick={onCancel}>Cancel</Button>
                <div className="flex gap-2">
                    {scannedImage && (
                        <Button
                            variant="default"
                            onClick={handleSave}
                            className="bg-green-600 hover:bg-green-700 text-white"
                        >
                            <CheckCircle className="mr-2 h-4 w-4" /> Save Document
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}

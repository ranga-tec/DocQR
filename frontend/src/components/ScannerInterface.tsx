import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Printer, CheckCircle, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ScannerInterfaceProps {
    onScanComplete: (file: File) => void;
    onCancel: () => void;
}

// Mock Scanners for Simulation Mode
const MOCK_SCANNERS = [
    { id: "s1", name: "Canon DR-C225 Office Scanner (Sim)" },
    { id: "s2", name: "HP LaserJet Pro MFP M428fdw (Sim)" },
    { id: "s3", name: "Epson WorkForce ES-400 (Sim)" }
];

// Hardware Service Configuration
const SCANNER_BRIDGE_URL = "/scan-service";

export function ScannerInterface({ onScanComplete, onCancel }: ScannerInterfaceProps) {
    const [mode, setMode] = useState<"simulation" | "hardware">("simulation");
    const [status, setStatus] = useState<"idle" | "searching" | "ready" | "scanning" | "processing" | "done" | "error">("searching");

    // Devices list (dynamic based on mode)
    const [devices, setDevices] = useState<{ id: string, name: string }[]>([]);

    // Selection & Settings
    const [selectedScanner, setSelectedScanner] = useState<string>("");
    const [dpi, setDpi] = useState("300");
    const [colorMode, setColorMode] = useState("color");

    // UI State
    const [progress, setProgress] = useState(0);
    const [scannedImage, setScannedImage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Initial Load & Mode Switching
    useEffect(() => {
        // Load settings
        const savedMode = localStorage.getItem("docqr_scanner_mode") as "simulation" | "hardware";
        if (savedMode) setMode(savedMode);

        const savedDpi = localStorage.getItem("docqr_scanner_dpi");
        if (savedDpi) setDpi(savedDpi);

        const savedColor = localStorage.getItem("docqr_scanner_color");
        if (savedColor) setColorMode(savedColor);

        // Trigger discovery based on preferred mode
        discoverScanners(savedMode || "simulation");
    }, []);

    const handleModeChange = (newMode: "simulation" | "hardware") => {
        setMode(newMode);
        localStorage.setItem("docqr_scanner_mode", newMode);
        discoverScanners(newMode);
    };

    const discoverScanners = async (currentMode: "simulation" | "hardware") => {
        setStatus("searching");
        setError(null);
        setDevices([]);
        setSelectedScanner("");

        if (currentMode === "simulation") {
            // Mock Discovery
            setTimeout(() => {
                setDevices(MOCK_SCANNERS);
                if (MOCK_SCANNERS.length > 0) {
                    setSelectedScanner(MOCK_SCANNERS[0].id);
                    setStatus("ready");
                }
            }, 1000);
        } else {
            // Real Hardware Discovery via Bridge
            try {
                // Fetch from /scan-service/api/config (or /devices depending on scanservjs version)
                // We'll try a generic config endpoint first
                const response = await fetch(`${SCANNER_BRIDGE_URL}/api/config`);

                if (!response.ok) {
                    throw new Error(`Bridge Service Unreachable (${response.status})`);
                }

                const data = await response.json();

                // Adapt response to our format
                // scanservjs usually returns { devices: [...] }
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
                    setStatus("ready");
                }

            } catch (err: any) {
                console.error("Scanner Bridge Error:", err);
                setError("Bridge Service Unreachable. Is scanservjs running on port 8080?");
                setStatus("error");
            }
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
        setProgress(0);
        setError(null);

        if (mode === "simulation") {
            // Mock Scan Logic
            const interval = setInterval(() => {
                setProgress(prev => {
                    if (prev >= 100) {
                        clearInterval(interval);
                        setStatus("processing");
                        setTimeout(() => {
                            setStatus("done");
                            setScannedImage("https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop");
                        }, 1000);
                        return 100;
                    }
                    return prev + 5;
                });
            }, 200);
        } else {
            // Real Hardware Scan Logic
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

                // Assuming scanservjs returns the image blob directly or a job ID
                // For simplicity in this integration, we expect a Blob response
                // (In robust implementations, we would poll the job ID)
                const blob = await response.blob();
                const imageUrl = URL.createObjectURL(blob);

                setStatus("done");
                setScannedImage(imageUrl);

            } catch (err: any) {
                console.error("Scan Failed:", err);
                setError(err.message || "Scanning failed");
                setStatus("error");
            }
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
        <div className="flex flex-col h-full bg-zinc-50 dark:bg-zinc-900 p-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h3 className="text-xl font-bold flex items-center gap-2">
                        <Printer className="w-6 h-6 text-primary" />
                        Hardware Scanner
                    </h3>
                    <p className="text-sm text-muted-foreground">
                        {mode === "simulation" ? "Running in Simulation Mode" : "Connected via Local Bridge"}
                    </p>
                </div>

                <div className="flex items-center gap-4">
                    {/* Mode Switcher */}
                    <div className="flex bg-neutral-200 dark:bg-neutral-800 rounded-lg p-1">
                        <button
                            onClick={() => handleModeChange("simulation")}
                            className={cn("px-3 py-1 text-xs font-medium rounded-md transition-all", mode === "simulation" ? "bg-white dark:bg-neutral-600 shadow-sm" : "hover:text-primary")}
                        >
                            Simulation
                        </button>
                        <button
                            onClick={() => handleModeChange("hardware")}
                            className={cn("px-3 py-1 text-xs font-medium rounded-md transition-all", mode === "hardware" ? "bg-white dark:bg-neutral-600 shadow-sm" : "hover:text-primary")}
                        >
                            Live Bridge
                        </button>
                    </div>

                    {status === "ready" && (
                        <div className="flex items-center gap-2 text-sm text-green-600 bg-green-100 dark:bg-green-900/30 px-3 py-1 rounded-full">
                            <div className="w-2 h-2 rounded-full bg-green-600 animate-pulse" />
                            {mode === "simulation" ? "Mock Ready" : "Device Ready"}
                        </div>
                    )}
                </div>
            </div>

            {/* Error State */}
            {status === "error" && (
                <div className="flex-1 flex flex-col items-center justify-center space-y-4 text-center p-8">
                    <AlertCircle className="w-12 h-12 text-destructive" />
                    <h4 className="text-lg font-bold text-destructive">Connection Failed</h4>
                    <p className="text-muted-foreground max-w-md">{error}</p>
                    <div className="flex gap-4">
                        <Button variant="outline" onClick={() => discoverScanners(mode)}>Retry Connection</Button>
                        <Button variant="ghost" onClick={() => handleModeChange("simulation")}>Switch to Simulation</Button>
                    </div>
                </div>
            )}

            {/* Searching State */}
            {status === "searching" && (
                <div className="flex-1 flex flex-col items-center justify-center space-y-4">
                    <Loader2 className="w-12 h-12 text-primary animate-spin" />
                    <p className="text-lg font-medium">Searching for {mode === "simulation" ? "simulated" : "local"} scanners...</p>
                    {mode === "hardware" && <p className="text-sm text-muted-foreground">Checking: http://localhost:8080/api/config</p>}
                </div>
            )}

            {/* Main Interface */}
            {(status === "ready" || status === "scanning" || status === "processing" || status === "done" || status === "idle") && status !== "error" && status !== "searching" && (
                <div className="grid grid-cols-3 gap-8 h-full">
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
                                    ) : status === "processing" ? (
                                        <>
                                            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Processing...
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
                    <div className="col-span-2 bg-neutral-100 dark:bg-neutral-800 rounded-lg border-2 border-dashed border-neutral-300 dark:border-neutral-600 flex items-center justify-center relative overflow-hidden">
                        {status === "scanning" && (
                            <div className="absolute inset-0 bg-black/50 z-10 flex flex-col items-center justify-center text-white">
                                <div className="w-64 space-y-2">
                                    <p className="text-center font-medium">Acquiring Image...</p>
                                    <div className="h-2 bg-neutral-600 rounded-full overflow-hidden">
                                        <div className="h-full bg-primary transition-all duration-200" style={{ width: `${progress}%` }} />
                                    </div>
                                    <p className="text-center text-xs text-neutral-400">{progress}%</p>
                                </div>
                            </div>
                        )}

                        {scannedImage ? (
                            <img src={scannedImage} alt="Scanned Document" className="max-w-full max-h-full shadow-2xl object-contain" />
                        ) : (
                            <div className="text-center text-muted-foreground">
                                <Printer className="w-16 h-16 mx-auto mb-4 opacity-20" />
                                <p>Preview will appear here</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {(status === "idle" && devices.length === 0) && (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                    <p className="text-muted-foreground">No devices found. Try refreshing or checking the connection.</p>
                    <Button variant="outline" className="mt-4" onClick={() => discoverScanners(mode)}>Refresh Devices</Button>
                </div>
            )}

            <div className="flex justify-between mt-6 pt-6 border-t">
                <Button variant="ghost" onClick={onCancel}>Cancel</Button>
                <div className="flex gap-2">
                    {status === "done" && (
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

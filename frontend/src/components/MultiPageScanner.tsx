import { useRef, useState, useCallback } from "react";
import Webcam from "react-webcam";
import { jsPDF } from "jspdf";
import { Button } from "@/components/ui/button";
import { Camera, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface MultiPageScannerProps {
    onDocumentCreated: (file: File) => void;
    onCancel: () => void;
}

export function MultiPageScanner({ onDocumentCreated, onCancel }: MultiPageScannerProps) {
    const webcamRef = useRef<Webcam>(null);
    const [pages, setPages] = useState<string[]>([]); // Array of base64 images

    const [currentViewIndex, setCurrentViewIndex] = useState<number | null>(null);

    const capture = useCallback(() => {
        const imageSrc = webcamRef.current?.getScreenshot();
        if (imageSrc) {
            setPages((prev) => [...prev, imageSrc]);
        }
    }, [webcamRef]);

    const deletePage = (index: number) => {
        setPages((prev) => prev.filter((_, i) => i !== index));
        if (currentViewIndex === index) setCurrentViewIndex(null);
    };

    const finalizeDocument = async () => {
        if (pages.length === 0) return;

        // Create PDF
        // Default to A4 size portrait
        const doc = new jsPDF({
            orientation: "p",
            unit: "mm",
            format: "a4"
        });

        const pdfWidth = doc.internal.pageSize.getWidth();
        doc.internal.pageSize.getHeight(); // height used implicitly for aspect ratio

        pages.forEach((pageData, index) => {
            if (index > 0) doc.addPage();

            // Calculate aspect ratio to fit page
            // Minimal implementation: Fit to width
            const imgProps = doc.getImageProperties(pageData);
            const imgWidth = pdfWidth;
            const imgHeight = (imgProps.height * pdfWidth) / imgProps.width;

            doc.addImage(pageData, "JPEG", 0, 0, imgWidth, imgHeight);
        });

        // Save as blob
        const pdfBlob = doc.output("blob");
        const file = new File([pdfBlob], `Scan_${new Date().toISOString().replace(/[:.]/g, "-")}.pdf`, { type: "application/pdf" });

        onDocumentCreated(file);
    };

    if (currentViewIndex !== null) {
        // Preview Mode for a single page
        return (
            <div className="flex flex-col items-center h-full p-4 space-y-4">
                <h3 className="font-semibold text-lg">Page {currentViewIndex + 1} Preview</h3>
                <img src={pages[currentViewIndex]} alt={`Page ${currentViewIndex + 1}`} className="max-h-[60vh] border shadow-lg" />
                <div className="flex gap-4">
                    <Button variant="outline" onClick={() => setCurrentViewIndex(null)}>Back to Scanner</Button>
                    <Button variant="destructive" onClick={() => deletePage(currentViewIndex)}>Delete Page</Button>
                </div>
            </div>
        )
    }

    return (
        <div className="flex flex-col h-full bg-black text-white rounded-lg overflow-hidden">
            {/* Viewport */}
            <div className="relative flex-1 bg-neutral-900 flex items-center justify-center overflow-hidden">
                <Webcam
                    audio={false}
                    ref={webcamRef}
                    screenshotFormat="image/jpeg"
                    width={1280}
                    height={720}
                    videoConstraints={{ facingMode: "environment" }}
                    className="w-full h-full object-contain"
                />

                {/* Overlay Guides */}
                <div className="absolute inset-0 border-2 border-white/20 pointer-events-none flex items-center justify-center">
                    <div className="w-[80%] h-[80%] border-2 border-dashed border-white/50 rounded-lg" />
                </div>
            </div>

            {/* Controls */}
            <div className="bg-neutral-800 p-4 space-y-4">
                {/* Thumbnails */}
                {pages.length > 0 && (
                    <div className="flex gap-2 overflow-x-auto pb-2">
                        {pages.map((page, idx) => (
                            <div
                                key={idx}
                                className="relative w-16 h-20 flex-shrink-0 cursor-pointer border-2 border-transparent hover:border-primary rounded overflow-hidden"
                                onClick={() => setCurrentViewIndex(idx)}
                            >
                                <img src={page} className="w-full h-full object-cover" />
                                <div className="absolute top-0 right-0 bg-black/50 text-[10px] px-1">{idx + 1}</div>
                            </div>
                        ))}
                    </div>
                )}

                <div className="flex items-center justify-between">
                    <Button variant="ghost" size="icon" onClick={onCancel} className="text-white hover:bg-white/20 h-12 w-12">
                        <XCircle className="w-8 h-8" />
                    </Button>

                    <Button
                        onClick={capture}
                        className="h-16 w-16 rounded-full bg-white text-black hover:bg-neutral-200 shadow-xl border-4 border-neutral-600"
                    >
                        <div className="w-full h-full rounded-full border-2 border-black p-3">
                            <Camera className="w-full h-full" />
                        </div>
                    </Button>

                    <Button
                        variant="default"
                        onClick={finalizeDocument}
                        disabled={pages.length === 0}
                        className={cn("h-12 px-6 font-bold", pages.length > 0 ? "bg-green-600 hover:bg-green-700" : "bg-neutral-600")}
                    >
                        {pages.length > 0 ? (
                            <>
                                Finish ({pages.length})
                                <CheckCircle2 className="ml-2 w-5 h-5" />
                            </>
                        ) : (
                            <span className="text-neutral-400">Scan First</span>
                        )}
                    </Button>
                </div>
                <div className="text-center text-xs text-neutral-400">
                    Hold steady and ensure document is within bounds
                </div>
            </div>
        </div>
    );
}

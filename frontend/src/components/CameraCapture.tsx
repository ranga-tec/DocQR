import { useRef, useState, useCallback } from "react";
import Webcam from "react-webcam";
import { Button } from "@/components/ui/button";
import { Camera, RefreshCw } from "lucide-react";

interface CameraCaptureProps {
    onCapture: (file: File) => void;
    onCancel: () => void;
}

export function CameraCapture({ onCapture, onCancel }: CameraCaptureProps) {
    const webcamRef = useRef<Webcam>(null);
    const [imageSrc, setImageSrc] = useState<string | null>(null);

    const capture = useCallback(() => {
        const imageSrc = webcamRef.current?.getScreenshot();
        if (imageSrc) {
            setImageSrc(imageSrc);
        }
    }, [webcamRef]);

    const retake = () => {
        setImageSrc(null);
    };

    const confirm = () => {
        if (imageSrc) {
            // Convert base64 to File
            fetch(imageSrc)
                .then((res) => res.blob())
                .then((blob) => {
                    const file = new File([blob], `scan_${Date.now()}.jpg`, { type: "image/jpeg" });
                    onCapture(file);
                });
        }
    };

    return (
        <div className="flex flex-col items-center gap-4 p-4 border rounded-lg bg-neutral-900 text-white">
            {imageSrc ? (
                <img src={imageSrc} alt="Scanned Document" className="rounded-lg shadow-lg border border-neutral-700 max-h-[400px]" />
            ) : (
                <Webcam
                    audio={false}
                    ref={webcamRef}
                    screenshotFormat="image/jpeg"
                    width={640}
                    height={480}
                    videoConstraints={{ facingMode: "environment" }}
                    className="rounded-lg shadow-lg border border-neutral-700 w-full max-h-[400px] object-cover"
                />
            )}

            <div className="flex gap-4">
                {imageSrc ? (
                    <>
                        <Button variant="secondary" onClick={retake}>
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Retake
                        </Button>
                        <Button onClick={confirm} className="bg-green-600 hover:bg-green-700 text-white">
                            Confirm & Upload
                        </Button>
                    </>
                ) : (
                    <>
                        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
                        <Button onClick={capture} className="bg-primary text-primary-foreground min-w-[120px]">
                            <Camera className="w-4 h-4 mr-2" />
                            Capture
                        </Button>
                    </>
                )}
            </div>
        </div>
    );
}

import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Camera, Upload, Scan, X, FileText, Loader2 } from "lucide-react";
import {
    fileToBase64,
    extractPrescriptionText,
    type ExtractedMedicine,
} from "@/lib/prescriptionOcr";

interface HandwrittenPrescriptionUploadProps {
    onImageChange: (file: File | null) => void;
    onTextExtracted: (medicines: ExtractedMedicine[], rawText: string) => void;
}

export function HandwrittenPrescriptionUpload({
    onImageChange,
    onTextExtracted,
}: HandwrittenPrescriptionUploadProps) {
    const [preview, setPreview] = useState<string | null>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [scanning, setScanning] = useState(false);
    const [rawText, setRawText] = useState<string>("");
    const [scanned, setScanned] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith("image/")) {
            toast.error("Please select an image file (JPG, PNG, etc.)");
            return;
        }

        if (file.size > 10 * 1024 * 1024) {
            toast.error("Image must be less than 10MB");
            return;
        }

        setSelectedFile(file);
        setScanned(false);
        setRawText("");
        onImageChange(file);

        const reader = new FileReader();
        reader.onload = () => setPreview(reader.result as string);
        reader.readAsDataURL(file);
    };

    const handleRemove = () => {
        setPreview(null);
        setSelectedFile(null);
        setScanned(false);
        setRawText("");
        onImageChange(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        if (cameraInputRef.current) cameraInputRef.current.value = "";
    };

    const handleScan = async () => {
        if (!selectedFile) {
            toast.error("Please upload an image first");
            return;
        }

        setScanning(true);
        try {
            const { base64, mimeType } = await fileToBase64(selectedFile);
            const result = await extractPrescriptionText(base64, mimeType);

            setRawText(result.rawText);
            setScanned(true);
            onTextExtracted(result.medicines, result.rawText);

            if (result.medicines.length > 0) {
                toast.success(
                    `Found ${result.medicines.length} medicine(s) in prescription`
                );
            } else {
                toast.warning(
                    "Could not extract medicines. The raw text is shown below."
                );
            }
        } catch (err: any) {
            console.error("OCR Error:", err);
            toast.error(err.message || "Failed to scan prescription");
        } finally {
            setScanning(false);
        }
    };

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Handwritten Prescription
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {!preview ? (
                    /* Upload Area */
                    <div className="flex flex-col items-center gap-4">
                        <div
                            className="flex w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/30 p-8 transition-colors hover:border-primary/50 hover:bg-muted/50"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <Upload className="mb-2 h-10 w-10 text-muted-foreground/60" />
                            <p className="text-sm font-medium text-muted-foreground">
                                Click to upload prescription image
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground/60">
                                JPG, PNG up to 10MB
                            </p>
                        </div>

                        <div className="flex gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <Upload className="mr-1 h-4 w-4" />
                                Browse Files
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => cameraInputRef.current?.click()}
                            >
                                <Camera className="mr-1 h-4 w-4" />
                                Take Photo
                            </Button>
                        </div>

                        {/* Hidden file inputs */}
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleFileSelect}
                        />
                        <input
                            ref={cameraInputRef}
                            type="file"
                            accept="image/*"
                            capture="environment"
                            className="hidden"
                            onChange={handleFileSelect}
                        />
                    </div>
                ) : (
                    /* Preview + Scan Area */
                    <div className="space-y-4">
                        <div className="relative">
                            <img
                                src={preview}
                                alt="Handwritten prescription"
                                className="w-full rounded-lg border object-contain"
                                style={{ maxHeight: "300px" }}
                            />
                            <Button
                                type="button"
                                size="icon"
                                variant="destructive"
                                className="absolute right-2 top-2 h-7 w-7"
                                onClick={handleRemove}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>

                        {!scanned && (
                            <Button
                                type="button"
                                onClick={handleScan}
                                disabled={scanning}
                                className="w-full"
                                variant="secondary"
                            >
                                {scanning ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Scanning prescription...
                                    </>
                                ) : (
                                    <>
                                        <Scan className="mr-2 h-4 w-4" />
                                        Scan Prescription
                                    </>
                                )}
                            </Button>
                        )}

                        {scanned && rawText && (
                            <div className="rounded-lg border bg-muted/30 p-3">
                                <p className="mb-1 text-xs font-medium text-muted-foreground">
                                    Extracted Text:
                                </p>
                                <p className="whitespace-pre-wrap text-sm">{rawText}</p>
                            </div>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

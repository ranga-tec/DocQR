import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { documentService, Document, UploadDocumentParams } from "@/services/document.service";
import { categoryService, Category } from "@/services/category.service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { QrCode, FileText, Trash2, Camera, Upload, Download, RefreshCw, X, PlusCircle, Printer, Tag, FolderOpen } from "lucide-react";
import { useForm } from "react-hook-form";
import { MultiPageScanner } from "@/components/MultiPageScanner";
import { ScannerInterface } from "@/components/ScannerInterface";
import { cn } from "@/lib/utils";
import { useSearchParams } from "react-router-dom";

interface UploadFormData {
    title: string;
    description: string;
    categoryId: string;
    tags: string;
}

export function DocumentsPage() {
    const queryClient = useQueryClient();
    const [searchParams, setSearchParams] = useSearchParams();
    const [search, setSearch] = useState("");
    const [uploadOpen, setUploadOpen] = useState(false);
    const [scanMode, setScanMode] = useState<"none" | "camera" | "hardware">("none");
    const [fileToUpload, setFileToUpload] = useState<File | null>(null);
    const isCreateQueryOpen = searchParams.get("new") === "1";

    const { data: documentsData, isLoading } = useQuery({
        queryKey: ["documents", search],
        queryFn: () => documentService.getAll({ page: 1, limit: 50, search }),
    });

    const { data: categories } = useQuery({
        queryKey: ["categories"],
        queryFn: () => categoryService.getAll(),
    });

    const uploadMutation = useMutation({
        mutationFn: documentService.upload,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["documents"] });
            closeUploadModal();
        },
    });

    const deleteMutation = useMutation({
        mutationFn: documentService.delete,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["documents"] });
        },
    });

    const { register, handleSubmit, reset, setValue, watch } = useForm<UploadFormData>({
        defaultValues: {
            title: "",
            description: "",
            categoryId: "",
            tags: "",
        }
    });

    const selectedCategoryId = watch("categoryId");

    useEffect(() => {
        if (isCreateQueryOpen) {
            setUploadOpen(true);
        }
    }, [isCreateQueryOpen]);

    const openUploadModal = () => {
        setUploadOpen(true);
    };

    const onUploadSubmit = (data: UploadFormData) => {
        if (!fileToUpload) return alert("Please select a file or scan a document.");

        const params: UploadDocumentParams = {
            file: fileToUpload,
            title: data.title,
            description: data.description || undefined,
            categoryId: data.categoryId || undefined,
            tags: data.tags || undefined,
        };

        uploadMutation.mutate(params);
    };

    const handleScanComplete = (file: File) => {
        setFileToUpload(file);
        setScanMode("none");
        setValue("title", `Scan ${format(new Date(), "yyyy-MM-dd HH:mm")}`);
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFileToUpload(e.target.files[0]);
            setValue("title", e.target.files[0].name.split('.')[0]);
        }
    };

    const closeUploadModal = () => {
        setUploadOpen(false);
        setScanMode("none");
        setFileToUpload(null);
        reset();

        if (isCreateQueryOpen) {
            const nextParams = new URLSearchParams(searchParams);
            nextParams.delete("new");
            setSearchParams(nextParams, { replace: true });
        }
    };

    const isScanning = scanMode !== "none";
    const documents = documentsData?.documents ?? [];

    return (
        <div className="space-y-6 h-full flex flex-col">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-card p-4 sm:p-6 rounded-xl shadow-sm border border-border/50">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">My Documents</h1>
                    <p className="text-muted-foreground mt-1">Manage, scan, and secure your files.</p>
                    <Button variant="link" className="h-auto p-0 mt-2 text-sm" onClick={openUploadModal}>
                        New document
                    </Button>
                </div>

                <Dialog
                    open={uploadOpen}
                    onOpenChange={(open) => {
                        if (open) {
                            setUploadOpen(true);
                        } else {
                            closeUploadModal();
                        }
                    }}
                >
                    <DialogTrigger asChild>
                        <Button size="lg" className="w-full sm:w-auto shadow-lg shadow-primary/20" onClick={openUploadModal}>
                            <PlusCircle className="mr-2 h-5 w-5" /> New Document
                        </Button>
                    </DialogTrigger>
                    <DialogContent
                        className={cn(
                            "top-4 translate-y-0 sm:top-[50%] sm:translate-y-[-50%] w-[calc(100vw-1rem)] sm:w-full max-w-[900px] max-h-[calc(100dvh-2rem)] p-0 bg-white dark:bg-zinc-900 text-zinc-950 dark:text-zinc-50 border shadow-2xl overflow-y-auto",
                            isScanning ? "h-[calc(100dvh-2rem)] sm:h-[85vh] w-[calc(100vw-1rem)] sm:w-[95vw] max-w-none overflow-hidden" : ""
                        )}
                    >
                        {!isScanning ? (
                            <div className="flex flex-col h-full">
                                <DialogHeader className="p-4 sm:p-6 border-b">
                                    <DialogTitle className="text-xl sm:text-2xl">Add New Document</DialogTitle>
                                </DialogHeader>

                                <div className="p-4 sm:p-6 grid gap-6 md:grid-cols-2">
                                    {/* Left: Action Buttons */}
                                    <div className="space-y-4">
                                        {/* Method 1: Upload File */}
                                        <div
                                            className="border-2 border-dashed border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-4 sm:p-6 flex items-center gap-4 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-500 transition-all cursor-pointer relative group"
                                            onClick={() => document.getElementById('file-input')?.click()}
                                        >
                                            <input id="file-input" type="file" className="hidden" onChange={handleFileSelect} accept=".pdf,.png,.jpg,.jpeg,.docx" />
                                            <div className="bg-blue-100 dark:bg-blue-900/40 p-3 rounded-full group-hover:scale-110 transition-transform flex-shrink-0">
                                                <Upload className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                                            </div>
                                            <div>
                                                <h3 className="font-semibold text-base">Upload File</h3>
                                                <p className="text-xs text-muted-foreground">PDF, JPG, PNG, DOCX</p>
                                            </div>
                                        </div>

                                        {/* Method 2: Camera Scan */}
                                        <div
                                            className="border-2 border-dashed border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-4 sm:p-6 flex items-center gap-4 hover:bg-purple-50 dark:hover:bg-purple-900/20 hover:border-purple-500 transition-all cursor-pointer group"
                                            onClick={() => setScanMode("camera")}
                                        >
                                            <div className="bg-purple-100 dark:bg-purple-900/40 p-3 rounded-full group-hover:scale-110 transition-transform flex-shrink-0">
                                                <Camera className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                                            </div>
                                            <div>
                                                <h3 className="font-semibold text-base">Camera Scan</h3>
                                                <p className="text-xs text-muted-foreground">Multi-page scan via webcam</p>
                                            </div>
                                        </div>

                                        {/* Method 3: Hardware Scanner */}
                                        <div
                                            className="border-2 border-dashed border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-4 sm:p-6 flex items-center gap-4 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 hover:border-emerald-500 transition-all cursor-pointer group"
                                            onClick={() => setScanMode("hardware")}
                                        >
                                            <div className="bg-emerald-100 dark:bg-emerald-900/40 p-3 rounded-full group-hover:scale-110 transition-transform flex-shrink-0">
                                                <Printer className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                                            </div>
                                            <div>
                                                <h3 className="font-semibold text-base">From Scanner (TWAIN)</h3>
                                                <p className="text-xs text-muted-foreground">Connect to office scanner</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right: Form Details */}
                                    <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-4 sm:p-6 border border-zinc-200 dark:border-zinc-700 h-fit">
                                        <h3 className="font-semibold mb-4 text-lg">Document Details</h3>
                                        <form onSubmit={handleSubmit(onUploadSubmit)} className="space-y-4">
                                            <div className="space-y-2">
                                                <label className="text-sm font-medium">Title <span className="text-destructive">*</span></label>
                                                <Input {...register("title", { required: true })} placeholder="e.g. Invoice #1024" className="bg-background" />
                                            </div>

                                            <div className="space-y-2">
                                                <label className="text-sm font-medium">Description</label>
                                                <Input {...register("description")} placeholder="Brief description..." className="bg-background" />
                                            </div>

                                            <div className="space-y-2">
                                                <label className="text-sm font-medium flex items-center gap-2">
                                                    <FolderOpen className="h-4 w-4" /> Category
                                                </label>
                                                <Select value={selectedCategoryId} onValueChange={(value) => setValue("categoryId", value)}>
                                                    <SelectTrigger className="bg-background">
                                                        <SelectValue placeholder="Select category (optional)" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="none">No Category</SelectItem>
                                                        {categories?.map((cat: Category) => (
                                                            <SelectItem key={cat.id} value={cat.id}>
                                                                {cat.name}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            <div className="space-y-2">
                                                <label className="text-sm font-medium flex items-center gap-2">
                                                    <Tag className="h-4 w-4" /> Tags
                                                </label>
                                                <Input
                                                    {...register("tags")}
                                                    placeholder="e.g. invoice, 2024, important (comma separated)"
                                                    className="bg-background"
                                                />
                                                <p className="text-xs text-muted-foreground">Separate multiple tags with commas</p>
                                            </div>

                                            <div className="min-h-[80px] border rounded-lg bg-background p-4 flex items-center justify-center">
                                                {fileToUpload ? (
                                                    <div className="text-center">
                                                        <FileText className="h-8 w-8 mx-auto text-green-500 mb-2" />
                                                        <p className="text-sm font-medium truncate max-w-[200px]">{fileToUpload.name}</p>
                                                        <p className="text-xs text-muted-foreground">{(fileToUpload.size / 1024).toFixed(1)} KB</p>
                                                        <div className="flex gap-2 justify-center mt-2">
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                type="button"
                                                                className="h-8"
                                                                onClick={() => {
                                                                    const url = URL.createObjectURL(fileToUpload);
                                                                    window.open(url, '_blank');
                                                                }}
                                                            >
                                                                <FileText className="h-3 w-3 mr-1" /> View
                                                            </Button>
                                                            <Button variant="ghost" size="sm" onClick={() => setFileToUpload(null)} className="text-destructive h-8 hover:bg-destructive/10">
                                                                <X className="h-3 w-3 mr-1" /> Remove
                                                            </Button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <p className="text-sm text-muted-foreground text-center">No file selected yet</p>
                                                )}
                                            </div>

                                            <div className="pt-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
                                                <Button variant="outline" type="button" onClick={closeUploadModal}>Cancel</Button>
                                                <Button type="submit" disabled={!fileToUpload || uploadMutation.isPending} className="min-w-[140px]">
                                                    {uploadMutation.isPending ? "Uploading..." : "Save & Generate QR"}
                                                </Button>
                                            </div>
                                        </form>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            scanMode === "camera" ? (
                                <MultiPageScanner onDocumentCreated={handleScanComplete} onCancel={() => setScanMode("none")} />
                            ) : (
                                <ScannerInterface onScanComplete={handleScanComplete} onCancel={() => setScanMode("none")} />
                            )
                        )}
                    </DialogContent>
                </Dialog>
            </div>

            <div className="flex items-center gap-2 max-w-full sm:max-w-sm bg-background p-1 rounded-lg border shadow-sm">
                <Input
                    placeholder="Search documents..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="border-none shadow-none focus-visible:ring-0"
                />
                <Button variant="ghost" size="icon" onClick={() => queryClient.invalidateQueries({ queryKey: ["documents"] })}>
                    <RefreshCw className="h-4 w-4" />
                </Button>
            </div>

            {/* Document List */}
            <div className="border rounded-xl bg-card shadow-sm overflow-hidden flex-1">
                <div className="hidden md:block">
                    <Table>
                        <TableHeader className="bg-muted/50">
                            <TableRow>
                                <TableHead className="w-[280px]">Document</TableHead>
                                <TableHead>Category</TableHead>
                                <TableHead>Tags</TableHead>
                                <TableHead>Created By</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead>Size</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-48 text-center">
                                        <div className="flex flex-col items-center justify-center text-muted-foreground">
                                            <RefreshCw className="h-8 w-8 animate-spin mb-2" />
                                            <p>Loading documents...</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : documents.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-48 text-center">
                                        <div className="flex flex-col items-center justify-center text-muted-foreground">
                                            <FileText className="h-10 w-10 mb-2 opacity-20" />
                                            <p>No documents found.</p>
                                            <Button variant="link" onClick={openUploadModal}>Upload your first document</Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                documents.map((doc: Document) => (
                                    <TableRow key={doc.id} className="group hover:bg-muted/30 transition-colors">
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                <div className="h-10 w-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                                                    <FileText className="h-5 w-5" />
                                                </div>
                                                <div className="min-w-0">
                                                    <div
                                                        className="font-semibold text-foreground group-hover:text-primary transition-colors cursor-pointer truncate"
                                                        onClick={() => documentService.download(doc.id, doc.file_name)}
                                                    >
                                                        {doc.title}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                                                        {doc.description || doc.file_name}
                                                    </div>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary text-secondary-foreground">
                                                {doc.category_name || "Uncategorized"}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-wrap gap-1 max-w-[120px]">
                                                {doc.tags && doc.tags.length > 0 ? (
                                                    doc.tags.slice(0, 2).map((tag: string, idx: number) => (
                                                        <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                                                            {tag}
                                                        </span>
                                                    ))
                                                ) : (
                                                    <span className="text-xs text-muted-foreground">-</span>
                                                )}
                                                {doc.tags && doc.tags.length > 2 && (
                                                    <span className="text-xs text-muted-foreground">+{doc.tags.length - 2}</span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <div className="h-6 w-6 rounded-full bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center text-xs font-medium">
                                                    {doc.created_by_username?.charAt(0).toUpperCase() || "?"}
                                                </div>
                                                <span className="text-sm">{doc.created_by_username || "Unknown"}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-muted-foreground text-sm">
                                            {format(new Date(doc.created_at), "MMM d, yyyy")}
                                        </TableCell>
                                        <TableCell className="text-muted-foreground text-sm">
                                            {(doc.file_size / 1024 / 1024).toFixed(2)} MB
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 hover:bg-primary/10 hover:text-primary"
                                                    title="Print Document"
                                                    onClick={() => documentService.print(doc.id)}
                                                >
                                                    <Printer className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 hover:bg-primary/10 hover:text-primary"
                                                    title="Download QR Code"
                                                    onClick={() => documentService.getQRCode(doc.id)}
                                                >
                                                    <QrCode className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 hover:bg-primary/10 hover:text-primary"
                                                    title="Download Document"
                                                    onClick={() => documentService.download(doc.id, doc.file_name)}
                                                >
                                                    <Download className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                                    onClick={() => deleteMutation.mutate(doc.id)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>

                <div className="md:hidden p-3 space-y-3">
                    {isLoading ? (
                        <div className="h-40 rounded-lg border flex flex-col items-center justify-center text-muted-foreground">
                            <RefreshCw className="h-7 w-7 animate-spin mb-2" />
                            <p>Loading documents...</p>
                        </div>
                    ) : documents.length === 0 ? (
                        <div className="h-40 rounded-lg border flex flex-col items-center justify-center text-muted-foreground">
                            <FileText className="h-10 w-10 mb-2 opacity-20" />
                            <p>No documents found.</p>
                            <Button variant="link" onClick={openUploadModal}>Upload your first document</Button>
                        </div>
                    ) : (
                        documents.map((doc: Document) => (
                            <div key={doc.id} className="rounded-lg border p-4 space-y-3">
                                <div className="space-y-1 min-w-0">
                                    <button
                                        type="button"
                                        className="font-semibold text-left w-full truncate"
                                        onClick={() => documentService.download(doc.id, doc.file_name)}
                                    >
                                        {doc.title}
                                    </button>
                                    <p className="text-xs text-muted-foreground break-words">{doc.description || doc.file_name}</p>
                                </div>

                                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                                        {doc.category_name || "Uncategorized"}
                                    </span>
                                    <span>{format(new Date(doc.created_at), "MMM d, yyyy")}</span>
                                    <span>{(doc.file_size / 1024 / 1024).toFixed(2)} MB</span>
                                </div>

                                {doc.tags && doc.tags.length > 0 && (
                                    <div className="flex flex-wrap gap-1">
                                        {doc.tags.slice(0, 4).map((tag: string, idx: number) => (
                                            <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                )}

                                <div className="flex flex-wrap gap-2 pt-1">
                                    <Button size="sm" variant="outline" onClick={() => documentService.print(doc.id)}>
                                        <Printer className="h-4 w-4 mr-1" /> Print
                                    </Button>
                                    <Button size="sm" variant="outline" onClick={() => documentService.getQRCode(doc.id)}>
                                        <QrCode className="h-4 w-4 mr-1" /> QR
                                    </Button>
                                    <Button size="sm" variant="outline" onClick={() => documentService.download(doc.id, doc.file_name)}>
                                        <Download className="h-4 w-4 mr-1" /> Download
                                    </Button>
                                    <Button size="sm" variant="outline" className="text-destructive hover:bg-destructive/10" onClick={() => deleteMutation.mutate(doc.id)}>
                                        <Trash2 className="h-4 w-4 mr-1" /> Delete
                                    </Button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Pagination Info */}
            {documentsData && documentsData.total > 0 && (
                <div className="text-sm text-muted-foreground text-center">
                    Showing {documents.length} of {documentsData.total} documents
                </div>
            )}
        </div>
    );
}

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileText, Download, Users, FolderOpen, HardDrive, RefreshCw } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { adminService } from "@/services/admin.service";
import { documentService, Document } from "@/services/document.service";
import { useNavigate } from "react-router-dom";

function formatBytes(bytes: number): string {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export function Dashboard() {
    const navigate = useNavigate();

    const { data: stats, isLoading: statsLoading } = useQuery({
        queryKey: ["admin-statistics"],
        queryFn: () => adminService.getStatistics(),
        retry: false,
    });

    const { data: recentDocs, isLoading: docsLoading } = useQuery({
        queryKey: ["recent-documents"],
        queryFn: () => documentService.getAll({ page: 1, limit: 5 }),
    });

    const storageUsedGB = stats ? stats.totalStorageBytes / (1024 * 1024 * 1024) : 0;
    const storageLimit = 100; // 100 GB limit
    const storagePercent = Math.min((storageUsedGB / storageLimit) * 100, 100);

    return (
        <div className="space-y-6">
            {/* Stats Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <StatsCard
                    title="Total Documents"
                    value={statsLoading ? "..." : (stats?.totalDocuments.toLocaleString() || "0")}
                    change="All active documents"
                    icon={<FileText className="h-4 w-4 text-muted-foreground" />}
                />
                <StatsCard
                    title="Storage Used"
                    value={statsLoading ? "..." : formatBytes(stats?.totalStorageBytes || 0)}
                    change={`${storagePercent.toFixed(1)}% of ${storageLimit} GB limit`}
                    icon={<HardDrive className="h-4 w-4 text-muted-foreground" />}
                />
                <StatsCard
                    title="Active Users"
                    value={statsLoading ? "..." : (stats?.totalUsers.toLocaleString() || "0")}
                    change="Registered users"
                    icon={<Users className="h-4 w-4 text-muted-foreground" />}
                />
                <StatsCard
                    title="Categories"
                    value={statsLoading ? "..." : (stats?.totalCategories.toLocaleString() || "0")}
                    change="Document categories"
                    icon={<FolderOpen className="h-4 w-4 text-muted-foreground" />}
                />
            </div>

            {/* Main Content Area */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">

                {/* Recent Documents */}
                <Card className="col-span-4 lg:col-span-5 border-none shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle>Recent Documents</CardTitle>
                            <CardDescription>
                                You manage {stats?.totalDocuments.toLocaleString() || 0} documents.
                            </CardDescription>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => navigate("/documents")}>
                            View All
                        </Button>
                    </CardHeader>
                    <CardContent>
                        {docsLoading ? (
                            <div className="flex items-center justify-center h-48 text-muted-foreground">
                                <RefreshCw className="h-6 w-6 animate-spin mr-2" />
                                Loading...
                            </div>
                        ) : recentDocs?.documents?.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                                <FileText className="h-10 w-10 mb-2 opacity-20" />
                                <p>No documents yet</p>
                                <Button variant="link" onClick={() => navigate("/documents")}>
                                    Upload your first document
                                </Button>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {recentDocs?.documents?.map((doc: Document) => (
                                    <div key={doc.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                                        <div className="flex items-center gap-4">
                                            <div className="h-10 w-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
                                                <FileText className="h-5 w-5" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium leading-none">{doc.title}</p>
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    {formatDistanceToNow(new Date(doc.created_at), { addSuffix: true })}
                                                    {doc.created_by_username && ` by ${doc.created_by_username}`}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                                onClick={() => documentService.download(doc.id)}
                                            >
                                                <Download className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Quick Upload & Stats */}
                <Card className="col-span-4 lg:col-span-2 border-none shadow-sm bg-primary/5">
                    <CardHeader>
                        <CardTitle>Quick Upload</CardTitle>
                        <CardDescription>
                            Drag and drop files here to upload instantly.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div
                            className="border-2 border-dashed border-primary/20 rounded-lg h-48 flex flex-col items-center justify-center text-center p-6 bg-background/50 hover:bg-background hover:border-primary/50 transition-all cursor-pointer"
                            onClick={() => navigate("/documents")}
                        >
                            <div className="h-12 w-12 bg-primary/10 rounded-full flex items-center justify-center mb-4 text-primary">
                                <Upload className="h-6 w-6" />
                            </div>
                            <p className="text-sm font-medium text-foreground">
                                Click to upload documents
                            </p>
                            <p className="text-xs text-muted-foreground mt-2">
                                Supports PDF, DOCX, XLSX, JPG, PNG up to 50MB
                            </p>
                        </div>

                        <div className="mt-6 space-y-4">
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Storage Used</span>
                                <span className="font-medium">
                                    {formatBytes(stats?.totalStorageBytes || 0)} / {storageLimit} GB
                                </span>
                            </div>
                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-primary transition-all duration-500"
                                    style={{ width: `${storagePercent}%` }}
                                />
                            </div>
                        </div>

                        {/* Category Breakdown */}
                        {stats?.documentsByCategory && stats.documentsByCategory.length > 0 && (
                            <div className="mt-6 space-y-3">
                                <h4 className="text-sm font-medium">Documents by Category</h4>
                                {stats.documentsByCategory.slice(0, 4).map((cat, idx) => (
                                    <div key={idx} className="flex justify-between text-sm">
                                        <span className="text-muted-foreground truncate max-w-[120px]">{cat.name}</span>
                                        <span className="font-medium">{cat.count}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

function StatsCard({ title, value, change, icon }: { title: string; value: string; change: string; icon: React.ReactNode }) {
    return (
        <Card className="border-none shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                    {title}
                </CardTitle>
                {icon}
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{value}</div>
                <p className="text-xs text-muted-foreground">
                    {change}
                </p>
            </CardContent>
        </Card>
    );
}

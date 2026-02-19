import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { categoryService, Category, CreateCategoryParams } from "@/services/category.service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { format } from "date-fns";
import { FolderOpen, Plus, Pencil, Trash2, RefreshCw, FileText } from "lucide-react";
import { useForm } from "react-hook-form";
import { useAuth } from "@/context/AuthContext";

export function CategoriesPage() {
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const isAdmin = user?.role === "admin";

    const [createOpen, setCreateOpen] = useState(false);
    const [editCategory, setEditCategory] = useState<Category | null>(null);

    const { data: categories, isLoading } = useQuery({
        queryKey: ["categories"],
        queryFn: () => categoryService.getAll(),
    });

    const createMutation = useMutation({
        mutationFn: categoryService.create,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["categories"] });
            setCreateOpen(false);
            createReset();
        },
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, params }: { id: string; params: Partial<CreateCategoryParams> }) =>
            categoryService.update(id, params),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["categories"] });
            setEditCategory(null);
            editReset();
        },
    });

    const deleteMutation = useMutation({
        mutationFn: categoryService.delete,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["categories"] });
        },
    });

    const {
        register: createRegister,
        handleSubmit: handleCreateSubmit,
        reset: createReset,
    } = useForm<CreateCategoryParams>();

    const {
        register: editRegister,
        handleSubmit: handleEditSubmit,
        reset: editReset,
        setValue: setEditValue,
    } = useForm<CreateCategoryParams>();

    const onCreateSubmit = (data: CreateCategoryParams) => {
        createMutation.mutate(data);
    };

    const onEditSubmit = (data: CreateCategoryParams) => {
        if (editCategory) {
            updateMutation.mutate({ id: editCategory.id, params: data });
        }
    };

    const openEditDialog = (category: Category) => {
        setEditCategory(category);
        setEditValue("name", category.name);
        setEditValue("description", category.description || "");
    };

    const handleDelete = (category: Category) => {
        if (category.document_count > 0) {
            alert(`Cannot delete category "${category.name}" because it has ${category.document_count} documents.`);
            return;
        }
        if (confirm(`Are you sure you want to delete "${category.name}"?`)) {
            deleteMutation.mutate(category.id);
        }
    };

    return (
        <div className="space-y-6 container mx-auto p-6">
            <div className="flex justify-between items-center bg-card p-6 rounded-xl shadow-sm border border-border/50">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">Categories</h1>
                    <p className="text-muted-foreground mt-1">Organize your documents with categories.</p>
                </div>

                {isAdmin && (
                    <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                        <DialogTrigger asChild>
                            <Button size="lg" className="shadow-lg shadow-primary/20">
                                <Plus className="mr-2 h-5 w-5" /> New Category
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[425px]">
                            <DialogHeader>
                                <DialogTitle>Create New Category</DialogTitle>
                            </DialogHeader>
                            <form onSubmit={handleCreateSubmit(onCreateSubmit)} className="space-y-4 mt-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">
                                        Name <span className="text-destructive">*</span>
                                    </label>
                                    <Input
                                        {...createRegister("name", { required: true })}
                                        placeholder="e.g. Invoices, Contracts"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Description</label>
                                    <Input
                                        {...createRegister("description")}
                                        placeholder="Brief description of this category"
                                    />
                                </div>
                                <div className="flex justify-end gap-3 pt-4">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => {
                                            setCreateOpen(false);
                                            createReset();
                                        }}
                                    >
                                        Cancel
                                    </Button>
                                    <Button type="submit" disabled={createMutation.isPending}>
                                        {createMutation.isPending ? "Creating..." : "Create Category"}
                                    </Button>
                                </div>
                            </form>
                        </DialogContent>
                    </Dialog>
                )}
            </div>

            {/* Categories Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {isLoading ? (
                    <div className="col-span-full flex items-center justify-center h-48 text-muted-foreground">
                        <RefreshCw className="h-6 w-6 animate-spin mr-2" />
                        Loading categories...
                    </div>
                ) : categories?.length === 0 ? (
                    <div className="col-span-full flex flex-col items-center justify-center h-48 text-muted-foreground bg-card rounded-xl border">
                        <FolderOpen className="h-12 w-12 mb-4 opacity-20" />
                        <p className="text-lg font-medium">No categories yet</p>
                        <p className="text-sm">Create your first category to organize documents.</p>
                    </div>
                ) : (
                    categories?.map((category: Category) => (
                        <div
                            key={category.id}
                            className="bg-card border rounded-xl p-6 hover:shadow-md transition-shadow group"
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
                                        <FolderOpen className="h-6 w-6" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-lg">{category.name}</h3>
                                        <p className="text-sm text-muted-foreground">
                                            {category.description || "No description"}
                                        </p>
                                    </div>
                                </div>

                                {isAdmin && (
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8"
                                            onClick={() => openEditDialog(category)}
                                        >
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                            onClick={() => handleDelete(category)}
                                            disabled={category.document_count > 0}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                )}
                            </div>

                            <div className="mt-4 pt-4 border-t flex items-center justify-between text-sm">
                                <div className="flex items-center gap-2 text-muted-foreground">
                                    <FileText className="h-4 w-4" />
                                    <span>{category.document_count} documents</span>
                                </div>
                                <span className="text-muted-foreground">
                                    Created {format(new Date(category.created_at), "MMM d, yyyy")}
                                </span>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Edit Dialog */}
            <Dialog open={!!editCategory} onOpenChange={(open) => !open && setEditCategory(null)}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Edit Category</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleEditSubmit(onEditSubmit)} className="space-y-4 mt-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">
                                Name <span className="text-destructive">*</span>
                            </label>
                            <Input
                                {...editRegister("name", { required: true })}
                                placeholder="e.g. Invoices, Contracts"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Description</label>
                            <Input
                                {...editRegister("description")}
                                placeholder="Brief description of this category"
                            />
                        </div>
                        <div className="flex justify-end gap-3 pt-4">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                    setEditCategory(null);
                                    editReset();
                                }}
                            >
                                Cancel
                            </Button>
                            <Button type="submit" disabled={updateMutation.isPending}>
                                {updateMutation.isPending ? "Saving..." : "Save Changes"}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminService, User, CreateUserParams } from "@/services/admin.service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableHead, TableHeader, TableRow, TableCell } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus, UserCheck, UserX, Shield, RefreshCw, Users } from "lucide-react";
import { format } from "date-fns";
import { useForm } from "react-hook-form";

export function UsersPage() {
    const queryClient = useQueryClient();
    const [createOpen, setCreateOpen] = useState(false);

    const { data: usersData, isLoading } = useQuery({
        queryKey: ["users"],
        queryFn: () => adminService.getUsers(1, 100),
    });

    const users = usersData?.users || [];

    const createMutation = useMutation({
        mutationFn: adminService.createUser,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["users"] });
            setCreateOpen(false);
            reset();
        },
    });

    const deactivateMutation = useMutation({
        mutationFn: adminService.deactivateUser,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["users"] });
        },
    });

    const { register, handleSubmit, reset, setValue, watch } = useForm<CreateUserParams>({
        defaultValues: {
            username: "",
            email: "",
            password: "",
            role: "user",
        },
    });

    const selectedRole = watch("role");

    const onCreateSubmit = (data: CreateUserParams) => {
        createMutation.mutate(data);
    };

    const handleDeactivate = (user: User) => {
        if (confirm(`Are you sure you want to deactivate "${user.username}"?`)) {
            deactivateMutation.mutate(user.id);
        }
    };

    const activeUsers = users.filter((u: User) => u.is_active);
    const adminCount = users.filter((u: User) => u.role === "admin").length;
    const inactiveCount = users.filter((u: User) => !u.is_active).length;

    return (
        <div className="space-y-6 container mx-auto p-6">
            <div className="flex justify-between items-center bg-card p-6 rounded-xl shadow-sm border border-border/50">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
                    <p className="text-muted-foreground">Manage system access and roles.</p>
                </div>

                <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                    <DialogTrigger asChild>
                        <Button size="lg" className="shadow-lg shadow-primary/20">
                            <UserPlus className="mr-2 h-5 w-5" /> Add User
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                            <DialogTitle>Create New User</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleSubmit(onCreateSubmit)} className="space-y-4 mt-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">
                                    Username <span className="text-destructive">*</span>
                                </label>
                                <Input
                                    {...register("username", { required: true })}
                                    placeholder="e.g. johndoe"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">
                                    Email <span className="text-destructive">*</span>
                                </label>
                                <Input
                                    {...register("email", { required: true })}
                                    type="email"
                                    placeholder="e.g. john@example.com"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">
                                    Password <span className="text-destructive">*</span>
                                </label>
                                <Input
                                    {...register("password", { required: true, minLength: 6 })}
                                    type="password"
                                    placeholder="Minimum 6 characters"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Role</label>
                                <Select value={selectedRole} onValueChange={(value: "admin" | "user") => setValue("role", value)}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select role" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="user">User</SelectItem>
                                        <SelectItem value="admin">Admin</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {createMutation.isError && (
                                <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                                    {(createMutation.error as Error)?.message || "Failed to create user"}
                                </div>
                            )}

                            <div className="flex justify-end gap-3 pt-4">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => {
                                        setCreateOpen(false);
                                        reset();
                                    }}
                                >
                                    Cancel
                                </Button>
                                <Button type="submit" disabled={createMutation.isPending}>
                                    {createMutation.isPending ? "Creating..." : "Create User"}
                                </Button>
                            </div>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardContent className="flex items-center p-6">
                        <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mr-4">
                            <Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                            <div className="text-2xl font-bold">{users.length}</div>
                            <div className="text-sm text-muted-foreground">Total Users</div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="flex items-center p-6">
                        <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mr-4">
                            <UserCheck className="h-6 w-6 text-green-600 dark:text-green-400" />
                        </div>
                        <div>
                            <div className="text-2xl font-bold">{activeUsers.length}</div>
                            <div className="text-sm text-muted-foreground">Active Users</div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="flex items-center p-6">
                        <div className="h-12 w-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center mr-4">
                            <Shield className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div>
                            <div className="text-2xl font-bold">{adminCount}</div>
                            <div className="text-sm text-muted-foreground">Administrators</div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="flex items-center p-6">
                        <div className="h-12 w-12 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center mr-4">
                            <UserX className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                        </div>
                        <div>
                            <div className="text-2xl font-bold">{inactiveCount}</div>
                            <div className="text-sm text-muted-foreground">Inactive Users</div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
                {isLoading ? (
                    <div className="flex items-center justify-center h-48 text-muted-foreground">
                        <RefreshCw className="h-6 w-6 animate-spin mr-2" />
                        Loading users...
                    </div>
                ) : (
                    <Table>
                        <TableHeader className="bg-muted/50">
                            <TableRow>
                                <TableHead className="w-[300px]">User</TableHead>
                                <TableHead>Role</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Joined</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {users.map((user: User) => (
                                <TableRow key={user.id} className="group hover:bg-muted/30">
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 rounded-full bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center font-semibold text-neutral-600 dark:text-neutral-300">
                                                {user.username.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <div className="font-medium">{user.username}</div>
                                                <div className="text-sm text-muted-foreground">{user.email}</div>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                            user.role === 'admin'
                                                ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
                                                : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                                        }`}>
                                            {user.role}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                            user.is_active
                                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
                                                : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                                        }`}>
                                            {user.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">
                                        {format(new Date(user.created_at), "MMM d, yyyy")}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {user.is_active && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
                                                onClick={() => handleDeactivate(user)}
                                            >
                                                <UserX className="h-4 w-4 mr-2" /> Deactivate
                                            </Button>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </div>
        </div>
    );
}

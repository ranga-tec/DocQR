import { useState } from "react"
import { Outlet, NavLink, useNavigate } from "react-router-dom"
import { QrCode, FileText, Settings, LogOut, Menu, X, Home, FolderOpen, Search, User, Bell } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

import { useAuth } from "@/context/AuthContext"

export function DashboardLayout() {
    const { user } = useAuth()
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const navigate = useNavigate()

    const handleLogout = () => {
        // In a real app, clear auth here
        navigate("/login")
    }

    return (
        <div className="flex h-screen bg-background overflow-hidden">
            {/* Sidebar Overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside className={cn(
                "fixed lg:static inset-y-0 left-0 w-64 border-r bg-background z-50 transform transition-transform duration-200 ease-in-out lg:translate-x-0 flex flex-col",
                sidebarOpen ? "translate-x-0" : "-translate-x-full"
            )}>
                {/* Logo */}
                <div className="h-16 flex items-center px-6 border-b">
                    <div className="bg-primary text-primary-foreground p-1.5 rounded-lg mr-3">
                        <QrCode className="h-5 w-5" />
                    </div>
                    <span className="font-bold text-lg tracking-tight">DOCQR</span>
                    <button
                        className="ml-auto lg:hidden"
                        onClick={() => setSidebarOpen(false)}
                    >
                        <X className="h-5 w-5 text-muted-foreground" />
                    </button>
                </div>

                {/* Navigation */}
                <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
                    <NavItem to="/" icon={<Home className="h-4 w-4" />} label="Dashboard" />
                    <NavItem to="/documents" icon={<FileText className="h-4 w-4" />} label="All Documents" />
                    <NavItem to="/scan" icon={<QrCode className="h-4 w-4" />} label="Quick Scan" />
                    <NavItem to="/categories" icon={<FolderOpen className="h-4 w-4" />} label="Categories" />

                    <div className="pt-4 pb-2 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        System
                    </div>
                    {user?.role === "admin" && (
                        <NavItem to="/admin/users" icon={<User className="h-4 w-4" />} label="User Management" />
                    )}
                    <NavItem to="/settings" icon={<Settings className="h-4 w-4" />} label="Settings" />
                </div>

                {/* User Footer */}
                <div className="p-4 border-t bg-muted/20">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium">
                            {user?.username?.charAt(0).toUpperCase() || "U"}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{user?.username || "User"}</p>
                            <p className="text-xs text-muted-foreground truncate">{user?.email || ""}</p>
                        </div>
                    </div>
                    <Button
                        variant="outline"
                        className="w-full justify-start text-muted-foreground hover:text-foreground"
                        onClick={handleLogout}
                    >
                        <LogOut className="mr-2 h-4 w-4" />
                        Log out
                    </Button>
                </div>
            </aside>

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {/* Header */}
                <header className="h-16 border-b bg-background flex items-center justify-between px-4 lg:px-8 shadow-sm z-10">
                    <div className="flex items-center gap-4">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="lg:hidden"
                            onClick={() => setSidebarOpen(true)}
                        >
                            <Menu className="h-5 w-5" />
                        </Button>

                        <div className="relative hidden md:block w-96">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search documents, tags, or content..."
                                className="pl-9 bg-muted/40 border-transparent focus:bg-background focus:border-input transition-all"
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-foreground">
                            <Bell className="h-5 w-5" />
                            <span className="absolute top-2.5 right-2.5 h-2 w-2 rounded-full bg-red-500 border-2 border-background"></span>
                        </Button>
                        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                            <User className="h-5 w-5" />
                        </Button>
                    </div>
                </header>

                {/* Content Area */}
                <main className="flex-1 overflow-y-auto bg-muted/10 p-4 lg:p-8">
                    <Outlet />
                </main>
            </div>
        </div>
    )
}

function NavItem({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
    return (
        <NavLink
            to={to}
            className={({ isActive }) => cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                isActive
                    ? "bg-primary/10 text-primary hover:bg-primary/15"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
        >
            {icon}
            {label}
        </NavLink>
    )
}

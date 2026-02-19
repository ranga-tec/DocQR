import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { api } from "@/lib/api/client";
import { useNavigate } from "react-router-dom";

export interface User {
    id: string;
    username: string;
    email: string;
    role: "admin" | "user";
    created_at: string;
}

interface AuthContextType {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (token: string, userData: User) => void;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const navigate = useNavigate();
    const [user, setUser] = useState<User | null>(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    // Check storage on mount
    useEffect(() => {
        const checkAuth = async () => {
            const token = localStorage.getItem("token");
            const storedUser = localStorage.getItem("user");

            if (token && storedUser) {
                try {
                    // Verify with backend
                    const { data } = await api.get("/auth/me");
                    setUser(data.user);
                    setIsAuthenticated(true);
                } catch (error) {
                    // Token invalid
                    localStorage.removeItem("token");
                    localStorage.removeItem("user");
                    setUser(null);
                    setIsAuthenticated(false);
                    // Only redirect if NOT on login page
                    if (!window.location.pathname.startsWith("/login")) {
                        navigate("/login");
                    }
                }
            }
            setIsLoading(false);
        };

        checkAuth();
    }, [navigate]);

    const login = (token: string, userData: User) => {
        localStorage.setItem("token", token);
        localStorage.setItem("user", JSON.stringify(userData));
        setUser(userData);
        setIsAuthenticated(true);
    };

    const logout = () => {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        setUser(null);
        setIsAuthenticated(false);
        navigate("/login");
    };

    return (
        <AuthContext.Provider value={{ user, isAuthenticated, isLoading, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}

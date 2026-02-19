import { api } from "@/lib/api/client";

export interface SystemStatistics {
    totalUsers: number;
    totalDocuments: number;
    totalCategories: number;
    totalStorageBytes: number;
    documentsPerDay: { date: string; count: number }[];
    documentsByCategory: { name: string; count: number }[];
}

export interface User {
    id: string;
    username: string;
    email: string;
    role: "admin" | "user";
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface CreateUserParams {
    username: string;
    email: string;
    password: string;
    role: "admin" | "user";
}

export interface UpdateUserParams {
    username?: string;
    email?: string;
    password?: string;
    role?: "admin" | "user";
    isActive?: boolean;
}

export interface AuditLog {
    id: string;
    user_id: string;
    username: string;
    action: string;
    resource_type: string;
    resource_id: string;
    details: Record<string, unknown>;
    ip_address: string;
    user_agent: string;
    created_at: string;
}

export const adminService = {
    // Statistics
    getStatistics: async (): Promise<SystemStatistics> => {
        const { data } = await api.get("/admin/statistics");
        return data.statistics;
    },

    // Users
    getUsers: async (page = 1, limit = 20): Promise<{ users: User[]; total: number }> => {
        const { data } = await api.get("/admin/users", { params: { page, limit } });
        return data;
    },

    getUserById: async (id: string): Promise<User> => {
        const { data } = await api.get(`/admin/users/${id}`);
        return data.user;
    },

    createUser: async (params: CreateUserParams): Promise<User> => {
        const { data } = await api.post("/admin/users", params);
        return data.user;
    },

    updateUser: async (id: string, params: UpdateUserParams): Promise<User> => {
        const { data } = await api.put(`/admin/users/${id}`, params);
        return data.user;
    },

    deactivateUser: async (id: string): Promise<void> => {
        await api.delete(`/admin/users/${id}`);
    },

    // Audit Logs
    getAuditLogs: async (params?: {
        page?: number;
        limit?: number;
        userId?: string;
        action?: string;
        resourceType?: string;
    }): Promise<{ logs: AuditLog[]; total: number }> => {
        const { data } = await api.get("/admin/audit-logs", { params });
        return data;
    },
};

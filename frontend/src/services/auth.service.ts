import { api } from "@/lib/api/client";
import { User } from "@/context/AuthContext";

export interface LoginRequest {
    email?: string;
    username?: string;
    password: string;
}

export const authService = {
    login: async (credentials: LoginRequest) => {
        const { data } = await api.post("/auth/login", credentials);
        return data;
    },

    logout: async () => {
        await api.post("/auth/logout");
    },

    me: async () => {
        const { data } = await api.get("/auth/me");
        return data.user as User;
    },
};

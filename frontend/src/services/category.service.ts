import { api } from "@/lib/api/client";

export interface Category {
    id: string;
    name: string;
    description: string;
    document_count: number;
    created_at: string;
    created_by_username: string;
    updated_at: string;
    updated_by_username: string;
}

export interface CreateCategoryParams {
    name: string;
    description?: string;
}

export const categoryService = {
    getAll: async (): Promise<Category[]> => {
        const { data } = await api.get("/categories");
        return data.categories;
    },

    getById: async (id: string): Promise<Category> => {
        const { data } = await api.get(`/categories/${id}`);
        return data.category;
    },

    create: async (params: CreateCategoryParams): Promise<Category> => {
        const { data } = await api.post("/categories", params);
        return data.category;
    },

    update: async (id: string, params: Partial<CreateCategoryParams>): Promise<Category> => {
        const { data } = await api.put(`/categories/${id}`, params);
        return data.category;
    },

    delete: async (id: string): Promise<void> => {
        await api.delete(`/categories/${id}`);
    },
};

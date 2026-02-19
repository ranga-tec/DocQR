import { api } from "@/lib/api/client";

export interface Document {
    id: string;
    title: string;
    description: string;
    file_name: string;
    file_size: number;
    mime_type: string;
    created_at: string;
    updated_at: string;
    category_id: string;
    category_name: string;
    qr_code_data: string;
    tags: string[];
    created_by_username: string;
    updated_by_username: string;
}

export interface UploadDocumentParams {
    file: File;
    title: string;
    description?: string;
    categoryId?: string;
    tags?: string;
}

export interface DocumentListResponse {
    documents: Document[];
    total: number;
    page: number;
    limit: number;
}

export const documentService = {
    getAll: async (params?: { page: number; limit: number; search?: string; categoryId?: string }): Promise<DocumentListResponse> => {
        const { data } = await api.get("/documents", { params });
        return data;
    },

    getById: async (id: string): Promise<Document> => {
        const { data } = await api.get(`/documents/${id}`);
        return data.document;
    },

    upload: async (params: UploadDocumentParams): Promise<Document> => {
        const formData = new FormData();
        formData.append("file", params.file);
        formData.append("title", params.title);
        if (params.description) {
            formData.append("description", params.description);
        }
        if (params.categoryId) {
            formData.append("categoryId", params.categoryId);
        }
        if (params.tags) {
            formData.append("tags", params.tags);
        }

        const { data } = await api.post("/documents", formData, {
            headers: {
                "Content-Type": "multipart/form-data",
            },
        });
        return data.document;
    },

    update: async (id: string, params: Partial<Omit<UploadDocumentParams, "file">>): Promise<Document> => {
        const { data } = await api.put(`/documents/${id}`, params);
        return data.document;
    },

    delete: async (id: string): Promise<void> => {
        await api.delete(`/documents/${id}`);
    },

    download: async (id: string, filename?: string) => {
        try {
            const response = await api.get(`/documents/${id}/download`, {
                responseType: 'blob',
            });

            // Create blob link to download
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;

            // Try to guess filename if not provided
            const contentDisposition = response.headers['content-disposition'];
            let finalFilename = filename || `document-${id}`;
            if (contentDisposition) {
                const fileNameMatch = contentDisposition.match(/filename="?(.+)"?/);
                if (fileNameMatch && fileNameMatch.length === 2)
                    finalFilename = fileNameMatch[1];
            }

            link.setAttribute('download', finalFilename);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error("Download failed:", error);
            alert("Failed to download document. Please try again.");
        }
    },

    view: async (id: string) => {
        try {
            const response = await api.get(`/documents/${id}/download`, {
                responseType: 'blob',
            });

            const file = new Blob([response.data], { type: response.headers['content-type'] || 'application/pdf' });
            const url = window.URL.createObjectURL(file);
            window.open(url, '_blank');
        } catch (error) {
            console.error("View failed:", error);
            alert("Failed to view document.");
        }
    },

    getQRCode: async (id: string) => {
        try {
            const response = await api.get(`/documents/${id}/qr`, {
                responseType: 'blob',
            });

            // Open blob in new tab for viewing
            const url = window.URL.createObjectURL(new Blob([response.data], { type: 'image/png' }));
            window.open(url, '_blank');

            // Note: We don't revoke immediately to let the new tab load it, 
            // strictly speaking we should manage this lifecycle but for simple view it's often ok.
            // A better UX might be a modal dialg with the image.
        } catch (error) {
            console.error("QR Code load failed:", error);
            alert("Failed to load QR code.");
        }
    },
};

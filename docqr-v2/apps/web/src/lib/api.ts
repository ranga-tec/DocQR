import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - add auth token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('accessToken');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - handle token refresh and errors
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Handle 401 - try to refresh token
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        try {
          const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
            refreshToken,
          });

          const { accessToken, refreshToken: newRefreshToken } = response.data;
          localStorage.setItem('accessToken', accessToken);
          localStorage.setItem('refreshToken', newRefreshToken);

          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          }
          return api(originalRequest);
        } catch {
          // Refresh failed - clear tokens and redirect to login
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('user');
          window.location.href = '/login';
        }
      } else {
        // No refresh token - redirect to login
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),

  register: (data: {
    email: string;
    username: string;
    password: string;
    firstName?: string;
    lastName?: string;
  }) => api.post('/auth/register', data),

  logout: (refreshToken: string) =>
    api.post('/auth/logout', { refreshToken }),

  getProfile: () => api.get('/auth/me'),

  refresh: (refreshToken: string) =>
    api.post('/auth/refresh', { refreshToken }),
};

// Dockets API
export const docketsApi = {
  list: (params?: Record<string, unknown>) =>
    api.get('/dockets', { params }),

  get: (id: string) =>
    api.get(`/dockets/${id}`),

  create: (data: {
    subject: string;
    description?: string;
    docketTypeId?: string;
    priority?: string;
    assignToUserId?: string;
  }) => api.post('/dockets', data),

  update: (id: string, data: Record<string, unknown>) =>
    api.put(`/dockets/${id}`, data),

  delete: (id: string) =>
    api.delete(`/dockets/${id}`),

  // QR
  getByQrToken: (token: string) =>
    api.get(`/dockets/qr/${token}`),

  getQrCode: (id: string) =>
    api.get(`/dockets/${id}/qr`, { responseType: 'blob' }),

  regenerateQr: (id: string) =>
    api.post(`/dockets/${id}/regenerate-qr`),

  // Workflow
  forward: (id: string, data: { toUserId?: string; toDepartmentId?: string; instructions?: string }) =>
    api.post(`/dockets/${id}/forward`, data),

  approve: (id: string, data?: { notes?: string }) =>
    api.post(`/dockets/${id}/approve`, data),

  reject: (id: string, data: { reason: string; notes?: string }) =>
    api.post(`/dockets/${id}/reject`, data),

  close: (id: string) =>
    api.post(`/dockets/${id}/close`),

  reopen: (id: string) =>
    api.post(`/dockets/${id}/reopen`),

  getHistory: (id: string) =>
    api.get(`/dockets/${id}/history`),

  getAllowedActions: (id: string) =>
    api.get(`/dockets/${id}/actions`),

  // Attachments
  getAttachments: (docketId: string) =>
    api.get(`/dockets/${docketId}/attachments`),

  uploadAttachment: (docketId: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/dockets/${docketId}/attachments`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  downloadAttachment: (docketId: string, attachmentId: string) =>
    api.get(`/dockets/${docketId}/attachments/${attachmentId}/download`, {
      responseType: 'blob',
    }),

  // Comments
  getComments: (docketId: string) =>
    api.get(`/dockets/${docketId}/comments`),

  addComment: (docketId: string, data: { content: string; commentType?: string }) =>
    api.post(`/dockets/${docketId}/comments`, data),
};

// Users API
export const usersApi = {
  list: (params?: Record<string, unknown>) =>
    api.get('/users', { params }),

  get: (id: string) =>
    api.get(`/users/${id}`),
};

// Departments API
export const departmentsApi = {
  list: () => api.get('/departments'),
  getHierarchy: () => api.get('/departments/hierarchy'),
};

// Docket Types API
export const docketTypesApi = {
  list: () => api.get('/docket-types'),
};

export default api;

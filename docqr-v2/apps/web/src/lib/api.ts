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

  updateProfile: (data: {
    email?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
  }) => api.put('/auth/profile', data),

  refresh: (refreshToken: string) =>
    api.post('/auth/refresh', { refreshToken }),

  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    api.post('/auth/change-password', data),
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
    senderName?: string;
    senderOrganization?: string;
    senderEmail?: string;
    senderPhone?: string;
    senderAddress?: string;
    receivedDate?: string;
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

  accept: (id: string, data?: { notes?: string }) =>
    api.post(`/dockets/${id}/accept`, data),

  submitForApproval: (id: string, data?: { notes?: string }) =>
    api.post(`/dockets/${id}/submit-approval`, data),

  reject: (id: string, data: { reason: string; notes?: string }) =>
    api.post(`/dockets/${id}/reject`, data),

  close: (id: string) =>
    api.post(`/dockets/${id}/close`),

  reopen: (id: string) =>
    api.post(`/dockets/${id}/reopen`),

  archive: (id: string, data?: { notes?: string }) =>
    api.post(`/dockets/${id}/archive`, data),

  return: (id: string, data?: { reason?: string; notes?: string }) =>
    api.post(`/dockets/${id}/return`, data),

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
    // Must explicitly set Content-Type to undefined so axios sets multipart/form-data with boundary
    return api.post(`/dockets/${docketId}/attachments`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },

  scanAttachment: (
    docketId: string,
    file: File,
    metadata?: {
      scannerProvider?: string;
      scannerDevice?: string;
      resolutionDpi?: number;
      colorMode?: string;
      pageCount?: number;
    }
  ) => {
    const formData = new FormData();
    formData.append('file', file);
    if (metadata?.scannerProvider) formData.append('scannerProvider', metadata.scannerProvider);
    if (metadata?.scannerDevice) formData.append('scannerDevice', metadata.scannerDevice);
    if (metadata?.resolutionDpi) formData.append('resolutionDpi', String(metadata.resolutionDpi));
    if (metadata?.colorMode) formData.append('colorMode', metadata.colorMode);
    if (metadata?.pageCount) formData.append('pageCount', String(metadata.pageCount));

    return api.post(`/dockets/${docketId}/attachments/scan`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },

  downloadAttachment: (docketId: string, attachmentId: string) =>
    api.get(`/dockets/${docketId}/attachments/${attachmentId}/download`, {
      responseType: 'blob',
    }),

  deleteAttachment: (docketId: string, attachmentId: string) =>
    api.delete(`/dockets/${docketId}/attachments/${attachmentId}`),

  // Attachment Integrity
  verifyAttachmentIntegrity: (docketId: string, attachmentId: string) =>
    api.post(`/dockets/${docketId}/attachments/${attachmentId}/verify`),

  getAttachmentIntegrity: (docketId: string, attachmentId: string) =>
    api.get(`/dockets/${docketId}/attachments/${attachmentId}/integrity`),

  getAttachmentContent: (docketId: string, attachmentId: string) =>
    api.get(`/dockets/${docketId}/attachments/${attachmentId}/content`),

  // Comments
  getComments: (docketId: string) =>
    api.get(`/dockets/${docketId}/comments`),

  addComment: (docketId: string, data: {
    content: string;
    commentType?: string;
    attachmentId?: string;
    parentCommentId?: string;
    isInternal?: boolean;
  }) =>
    api.post(`/dockets/${docketId}/comments`, data),

  addCommentWithAttachment: (
    docketId: string,
    payload: {
      file: File;
      content: string;
      commentType?: string;
      parentCommentId?: string;
      isInternal?: boolean;
    }
  ) => {
    const formData = new FormData();
    formData.append('file', payload.file);
    formData.append('content', payload.content);
    if (payload.commentType) formData.append('commentType', payload.commentType);
    if (payload.parentCommentId) formData.append('parentCommentId', payload.parentCommentId);
    if (payload.isInternal !== undefined) formData.append('isInternal', String(payload.isInternal));

    return api.post(`/dockets/${docketId}/comments/with-attachment`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
};

// Users API
export const usersApi = {
  list: (params?: Record<string, unknown>) =>
    api.get('/users', { params }),

  get: (id: string) =>
    api.get(`/users/${id}`),

  create: (data: {
    email: string;
    username: string;
    password: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    roleIds?: string[];
    departmentIds?: string[];
  }) => api.post('/users', data),

  update: (id: string, data: {
    email?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    avatar?: string;
    isActive?: boolean;
    roleIds?: string[];
    departmentIds?: string[];
  }) => api.put(`/users/${id}`, data),

  delete: (id: string) =>
    api.delete(`/users/${id}`),
};

// Departments API
export const departmentsApi = {
  list: () => api.get('/departments'),
  get: (id: string) => api.get(`/departments/${id}`),
  create: (data: {
    name: string;
    code: string;
    description?: string;
    parentId?: string;
    headUserId?: string;
  }) => api.post('/departments', data),
  update: (id: string, data: {
    name?: string;
    description?: string;
    parentId?: string;
    headUserId?: string;
    isActive?: boolean;
  }) => api.put(`/departments/${id}`, data),
  delete: (id: string) => api.delete(`/departments/${id}`),
  getUsers: (id: string) => api.get(`/departments/${id}/users`),
  getHierarchy: () => api.get('/departments/hierarchy'),
};

// Docket Types API
export const docketTypesApi = {
  list: (params?: { includeInactive?: boolean }) => api.get('/docket-types', { params }),
  get: (id: string) => api.get(`/docket-types/${id}`),
  create: (data: {
    name: string;
    code: string;
    description?: string;
    slaDays?: number;
    requiresApproval?: boolean;
    isActive?: boolean;
  }) => api.post('/docket-types', data),
  update: (id: string, data: {
    name?: string;
    code?: string;
    description?: string;
    slaDays?: number;
    requiresApproval?: boolean;
    isActive?: boolean;
  }) => api.put(`/docket-types/${id}`, data),
  delete: (id: string) => api.delete(`/docket-types/${id}`),
};

// Notifications API
export const notificationsApi = {
  list: (params?: { limit?: number; offset?: number; unreadOnly?: boolean }) =>
    api.get('/notifications', { params }),

  unreadCount: () => api.get('/notifications/unread-count'),

  markAsRead: (id: string) => api.post(`/notifications/${id}/read`),

  markAllAsRead: () => api.post('/notifications/mark-all-read'),

  getPreferences: () => api.get('/notifications/preferences'),

  updatePreferences: (data: {
    emailEnabled?: boolean;
    smsEnabled?: boolean;
    inAppEnabled?: boolean;
    quietHoursEnabled?: boolean;
    quietHoursStart?: string | null;
    quietHoursEnd?: string | null;
    timeZone?: string;
    deliveryMode?: 'immediate' | 'digest';
    digestFrequency?: 'daily' | 'weekly';
  }) => api.put('/notifications/preferences', data),

  sendDigest: () => api.post('/notifications/digest/send'),
};

// OnlyOffice API
export const onlyOfficeApi = {
  getEditorConfig: (attachmentId: string, mode: 'view' | 'edit' = 'edit') =>
    api.get(`/onlyoffice/config/${attachmentId}`, { params: { mode } }),
};

// Registers API
export const registersApi = {
  // Physical Registers
  list: (params?: { departmentId?: string; registerType?: string; isActive?: boolean }) =>
    api.get('/registers', { params }),

  get: (id: string) =>
    api.get(`/registers/${id}`),

  create: (data: {
    name: string;
    registerCode: string;
    description?: string;
    departmentId?: string;
    registerType: 'inward' | 'outward' | 'contract' | 'general';
    yearStart?: string;
    yearEnd?: string;
  }) => api.post('/registers', data),

  update: (id: string, data: Record<string, unknown>) =>
    api.put(`/registers/${id}`, data),

  delete: (id: string) =>
    api.delete(`/registers/${id}`),

  getStats: () =>
    api.get('/registers/stats'),

  getNextEntryNumber: (registerId: string) =>
    api.get(`/registers/${registerId}/next-entry-number`),

  // Register Entries
  listEntries: (params?: {
    registerId?: string;
    search?: string;
    page?: number;
    limit?: number;
    fromDate?: string;
    toDate?: string;
  }) => api.get('/registers/entries', { params }),

  getEntry: (id: string) =>
    api.get(`/registers/entries/${id}`),

  createEntry: (data: {
    registerId: string;
    entryNumber: string;
    entryDate: string;
    subject: string;
    fromParty?: string;
    toParty?: string;
    remarks?: string;
    docketId?: string;
  }) => api.post('/registers/entries', data),

  updateEntry: (id: string, data: Record<string, unknown>) =>
    api.put(`/registers/entries/${id}`, data),

  deleteEntry: (id: string) =>
    api.delete(`/registers/entries/${id}`),

  linkDocket: (entryId: string, docketId: string) =>
    api.post(`/registers/entries/${entryId}/link-docket/${docketId}`),

  unlinkDocket: (entryId: string) =>
    api.delete(`/registers/entries/${entryId}/unlink-docket`),

  exportEntriesExcel: (params?: {
    registerId?: string;
    search?: string;
    fromDate?: string;
    toDate?: string;
  }) => api.get('/registers/entries/export/excel', { params, responseType: 'blob' }),

  exportEntriesPdf: (params?: {
    registerId?: string;
    search?: string;
    fromDate?: string;
    toDate?: string;
  }) => api.get('/registers/entries/export/pdf', { params, responseType: 'blob' }),
};

// Roles API
export const rolesApi = {
  list: () => api.get('/roles'),

  get: (id: string) => api.get(`/roles/${id}`),

  create: (data: {
    name: string;
    displayName?: string;
    description?: string;
    permissions?: string[];
  }) => api.post('/roles', {
    ...data,
    permissions: data.permissions || [],
  }),

  update: (id: string, data: Record<string, unknown>) =>
    api.put(`/roles/${id}`, data),

  delete: (id: string) => api.delete(`/roles/${id}`),

  assignToUser: (roleId: string, userId: string) =>
    api.post(`/roles/${roleId}/users`, { userId }),

  removeFromUser: (roleId: string, userId: string) =>
    api.delete(`/roles/${roleId}/users/${userId}`),

  getPermissions: () => api.get('/roles/permissions'),
};

// Signing placeholder API
export const signingApi = {
  listProviders: () => api.get('/signing/providers'),

  createRequest: (data: {
    docketId: string;
    attachmentId: string;
    provider?: 'signex' | 'stellasign' | 'placeholder';
    signers: Array<{ userId: string; order: number; role?: string }>;
    expiresAt?: string;
  }) => api.post('/signing/requests', data),

  getRequest: (id: string) => api.get(`/signing/requests/${id}`),

  dispatchRequest: (id: string) => api.post(`/signing/requests/${id}/dispatch`),
};

// Admin API
export const adminApi = {
  stats: () => api.get('/admin/stats'),

  auditLogs: (params?: {
    userId?: string;
    action?: string;
    resourceType?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) => api.get('/admin/audit-logs', { params }),

  slaReport: () => api.get('/admin/reports/sla'),

  workloadReport: () => api.get('/admin/reports/workload'),

  turnaroundReport: () => api.get('/admin/reports/turnaround'),
};

export default api;

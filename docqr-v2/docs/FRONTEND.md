# DOCQR v2 - Frontend Documentation

## Overview

The frontend is a React 19 application built with Vite, TailwindCSS, and Radix UI components.

```
apps/web/
├── src/
│   ├── components/     # Reusable UI components
│   ├── context/        # React context providers
│   ├── hooks/          # Custom hooks
│   ├── lib/            # Utilities and API client
│   ├── pages/          # Page components
│   ├── types/          # TypeScript definitions
│   ├── App.tsx         # Router configuration
│   └── main.tsx        # Entry point
├── public/             # Static assets
├── index.html          # HTML template
├── vite.config.ts      # Vite configuration
├── tailwind.config.js  # TailwindCSS config
└── tsconfig.json       # TypeScript config
```

---

## Tech Stack

| Library | Version | Purpose |
|---------|---------|---------|
| React | 19.0.0 | UI framework |
| Vite | 6.1.0 | Build tool |
| React Router | 7.x | Routing |
| TailwindCSS | 4.x | Styling |
| Radix UI | Latest | Accessible primitives |
| Axios | 1.x | HTTP client |
| React Query | 5.x | Data fetching |
| Lucide React | 0.468+ | Icons |
| date-fns | 4.x | Date formatting |

---

## Getting Started

```bash
# Install dependencies
cd apps/web
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

---

## Project Structure

### Components

```
components/
├── ui/                 # Base UI components (from shadcn/ui)
│   ├── Button.tsx
│   ├── Card.tsx
│   ├── Dialog.tsx
│   ├── Input.tsx
│   ├── Select.tsx
│   ├── Table.tsx
│   └── ...
├── layout/             # Layout components
│   ├── DashboardLayout.tsx
│   ├── Sidebar.tsx
│   └── Header.tsx
├── dockets/            # Docket-specific components
│   ├── DocketCard.tsx
│   ├── DocketForm.tsx
│   ├── DocketActions.tsx
│   ├── AttachmentList.tsx
│   └── CommentThread.tsx
└── shared/             # Shared components
    ├── ProtectedRoute.tsx
    ├── LoadingSpinner.tsx
    ├── ErrorBoundary.tsx
    └── Pagination.tsx
```

### Pages

```
pages/
├── Login.tsx           # Login form
├── Register.tsx        # Registration form
├── Dashboard.tsx       # Main dashboard
├── dockets/
│   ├── DocketsList.tsx    # Docket listing
│   ├── DocketDetail.tsx   # Single docket view
│   └── DocketCreate.tsx   # Create docket form
├── admin/
│   ├── Users.tsx          # User management
│   ├── Roles.tsx          # Role management
│   └── AuditLogs.tsx      # Audit log viewer
└── QrScan.tsx          # Public QR scan page
```

---

## Routing

### Route Configuration

```typescript
// App.tsx
<Routes>
  {/* Public routes */}
  <Route path="/login" element={<Login />} />
  <Route path="/register" element={<Register />} />
  <Route path="/qr/:token" element={<QrScan />} />

  {/* Protected routes */}
  <Route element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
    <Route index element={<Navigate to="/dashboard" />} />
    <Route path="/dashboard" element={<Dashboard />} />
    <Route path="/dockets" element={<DocketsList />} />
    <Route path="/dockets/new" element={<DocketCreate />} />
    <Route path="/dockets/:id" element={<DocketDetail />} />

    {/* Admin routes */}
    <Route path="/admin/users" element={<AdminUsers />} />
    <Route path="/admin/roles" element={<AdminRoles />} />
  </Route>

  {/* Catch-all */}
  <Route path="*" element={<NotFound />} />
</Routes>
```

### Protected Route Component

```typescript
// components/ProtectedRoute.tsx
export function ProtectedRoute({ children, permission }: Props) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (permission && !hasPermission(user, permission)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
}
```

---

## Authentication

### Auth Context

```typescript
// context/AuthContext.tsx
interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
  hasRole: (role: string) => boolean;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for existing session on mount
    checkAuth();
  }, []);

  // ... implementation
}

export function useAuth() {
  return useContext(AuthContext);
}
```

### Token Storage

```typescript
// lib/auth.ts
const ACCESS_TOKEN_KEY = 'docqr_access_token';
const REFRESH_TOKEN_KEY = 'docqr_refresh_token';

export function setTokens(accessToken: string, refreshToken: string) {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}
```

---

## API Client

### Configuration

```typescript
// lib/api.ts
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - add auth token
api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor - handle 401 and refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Try to refresh token
      const refreshed = await refreshToken();
      if (refreshed) {
        return api.request(error.config);
      }
      // Redirect to login
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
```

### API Services

```typescript
// lib/api.ts

// Auth API
export const authApi = {
  login: (data: LoginData) => api.post('/auth/login', data),
  register: (data: RegisterData) => api.post('/auth/register', data),
  refresh: (token: string) => api.post('/auth/refresh', { refreshToken: token }),
  me: () => api.get('/auth/me'),
  logout: () => api.post('/auth/logout'),
};

// Dockets API
export const docketsApi = {
  list: (params?: DocketQueryParams) => api.get('/dockets', { params }),
  get: (id: string) => api.get(`/dockets/${id}`),
  create: (data: CreateDocketData) => api.post('/dockets', data),
  update: (id: string, data: UpdateDocketData) => api.put(`/dockets/${id}`, data),
  delete: (id: string) => api.delete(`/dockets/${id}`),
  forward: (id: string, data: ForwardData) => api.post(`/dockets/${id}/forward`, data),
  approve: (id: string, data?: ApproveData) => api.post(`/dockets/${id}/approve`, data),
  reject: (id: string, data: RejectData) => api.post(`/dockets/${id}/reject`, data),
  close: (id: string) => api.post(`/dockets/${id}/close`),
  getQrCode: (id: string) => api.get(`/dockets/${id}/qr`, { responseType: 'blob' }),
  scanQr: (token: string) => api.get(`/dockets/qr/${token}`),
  getHistory: (id: string) => api.get(`/dockets/${id}/history`),
  getActions: (id: string) => api.get(`/dockets/${id}/actions`),
};

// Attachments API
export const attachmentsApi = {
  list: (docketId: string) => api.get(`/dockets/${docketId}/attachments`),
  upload: (docketId: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/dockets/${docketId}/attachments`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  download: (docketId: string, attachmentId: string) =>
    api.get(`/dockets/${docketId}/attachments/${attachmentId}/download`, {
      responseType: 'blob',
    }),
  delete: (docketId: string, attachmentId: string) =>
    api.delete(`/dockets/${docketId}/attachments/${attachmentId}`),
};

// Comments API
export const commentsApi = {
  list: (docketId: string) => api.get(`/dockets/${docketId}/comments`),
  create: (docketId: string, data: CreateCommentData) =>
    api.post(`/dockets/${docketId}/comments`, data),
};
```

---

## State Management

### React Query for Server State

```typescript
// hooks/useDockets.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export function useDockets(params?: DocketQueryParams) {
  return useQuery({
    queryKey: ['dockets', params],
    queryFn: () => docketsApi.list(params),
  });
}

export function useDocket(id: string) {
  return useQuery({
    queryKey: ['docket', id],
    queryFn: () => docketsApi.get(id),
    enabled: !!id,
  });
}

export function useCreateDocket() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: docketsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dockets'] });
    },
  });
}

export function useForwardDocket() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ForwardData }) =>
      docketsApi.forward(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['docket', id] });
      queryClient.invalidateQueries({ queryKey: ['dockets'] });
    },
  });
}
```

### Context for Global State

```typescript
// Auth state -> AuthContext
// Notifications -> NotificationContext (toast messages)
// Theme -> ThemeContext (if dark mode)
```

---

## Styling

### TailwindCSS Configuration

```javascript
// tailwind.config.js
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f9ff',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
        },
        // Add more custom colors
      },
    },
  },
  plugins: [],
};
```

### Component Styling Pattern

```typescript
// Using clsx for conditional classes
import clsx from 'clsx';

function Button({ variant = 'primary', size = 'md', className, ...props }) {
  return (
    <button
      className={clsx(
        'rounded font-medium transition-colors',
        {
          'bg-primary-600 text-white hover:bg-primary-700': variant === 'primary',
          'bg-gray-200 text-gray-800 hover:bg-gray-300': variant === 'secondary',
          'px-3 py-1.5 text-sm': size === 'sm',
          'px-4 py-2': size === 'md',
          'px-6 py-3 text-lg': size === 'lg',
        },
        className
      )}
      {...props}
    />
  );
}
```

---

## Forms

### Form Handling with React Hook Form

```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const docketSchema = z.object({
  subject: z.string().min(1, 'Subject is required').max(500),
  description: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
  docketTypeId: z.string().uuid('Select a docket type'),
  assignToUserId: z.string().uuid().optional(),
  dueDate: z.string().optional(),
});

type DocketFormData = z.infer<typeof docketSchema>;

function DocketForm({ onSubmit }: { onSubmit: (data: DocketFormData) => void }) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<DocketFormData>({
    resolver: zodResolver(docketSchema),
    defaultValues: {
      priority: 'MEDIUM',
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div>
        <label>Subject</label>
        <input {...register('subject')} />
        {errors.subject && <span>{errors.subject.message}</span>}
      </div>
      {/* More fields */}
      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Creating...' : 'Create Docket'}
      </button>
    </form>
  );
}
```

---

## Environment Variables

```bash
# .env.local
VITE_API_URL=http://localhost:3000/api/v1
VITE_APP_NAME=DOCQR
VITE_APP_VERSION=2.0.0
```

Access in code:
```typescript
const apiUrl = import.meta.env.VITE_API_URL;
```

---

## Building for Production

```bash
# Build
npm run build

# Output in dist/
# Deploy dist/ to any static hosting
```

### Build Output

```
dist/
├── index.html
├── assets/
│   ├── index-[hash].js      # Main bundle
│   ├── index-[hash].css     # Styles
│   └── vendor-[hash].js     # Vendor chunks
└── favicon.ico
```

---

## Testing

### Unit Tests with Vitest

```typescript
// __tests__/components/Button.test.tsx
import { render, screen } from '@testing-library/react';
import { Button } from '../components/ui/Button';

describe('Button', () => {
  it('renders with text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('calls onClick handler', async () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click me</Button>);
    await userEvent.click(screen.getByText('Click me'));
    expect(handleClick).toHaveBeenCalled();
  });
});
```

### E2E Tests with Playwright

```typescript
// e2e/login.spec.ts
import { test, expect } from '@playwright/test';

test('user can login', async ({ page }) => {
  await page.goto('/login');
  await page.fill('[name="email"]', 'admin@docqr.local');
  await page.fill('[name="password"]', 'admin123');
  await page.click('button[type="submit"]');

  await expect(page).toHaveURL('/dashboard');
  await expect(page.getByText('Welcome back')).toBeVisible();
});
```

---

## Performance Optimization

### Code Splitting

```typescript
// Lazy load routes
const Dashboard = lazy(() => import('./pages/Dashboard'));
const DocketDetail = lazy(() => import('./pages/dockets/DocketDetail'));

// In router
<Suspense fallback={<LoadingSpinner />}>
  <Route path="/dashboard" element={<Dashboard />} />
</Suspense>
```

### Image Optimization

```typescript
// Use responsive images
<img
  src={thumbnailUrl}
  srcSet={`${smallUrl} 300w, ${mediumUrl} 600w, ${largeUrl} 1200w`}
  sizes="(max-width: 300px) 100vw, 300px"
  loading="lazy"
  alt="Document thumbnail"
/>
```

### Memoization

```typescript
// Memoize expensive components
const DocketCard = memo(function DocketCard({ docket }: Props) {
  return (
    // ...
  );
});

// Memoize callbacks
const handleSubmit = useCallback((data) => {
  // ...
}, [dependencies]);

// Memoize computed values
const filteredDockets = useMemo(() => {
  return dockets.filter(d => d.status === filter);
}, [dockets, filter]);
```

---

## Accessibility

### Guidelines

1. Use semantic HTML elements
2. Include ARIA labels where needed
3. Ensure keyboard navigation works
4. Maintain color contrast ratios
5. Test with screen readers

```typescript
// Accessible button example
<button
  type="button"
  aria-label="Close dialog"
  aria-pressed={isPressed}
  onClick={handleClose}
>
  <XIcon aria-hidden="true" />
</button>

// Accessible form field
<div>
  <label htmlFor="email" id="email-label">
    Email address
  </label>
  <input
    id="email"
    type="email"
    aria-labelledby="email-label"
    aria-describedby="email-error"
    aria-invalid={!!errors.email}
  />
  {errors.email && (
    <span id="email-error" role="alert">
      {errors.email.message}
    </span>
  )}
</div>
```

---

## Adding New Features

### Creating a New Page

1. Create page component in `pages/`
2. Add route in `App.tsx`
3. Add navigation link in `Sidebar.tsx`
4. Create any required hooks in `hooks/`

### Creating a New Component

1. Create component in appropriate folder
2. Export from `components/index.ts`
3. Add Storybook story (if using)
4. Add tests

### Adding API Endpoints

1. Add method to appropriate API service in `lib/api.ts`
2. Create React Query hook in `hooks/`
3. Use in components

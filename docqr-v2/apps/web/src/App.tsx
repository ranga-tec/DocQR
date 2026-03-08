import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import DashboardLayout from './components/layout/DashboardLayout';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Inbox from './pages/Inbox';
import DocketsList from './pages/dockets/DocketsList';
import CreateDocket from './pages/dockets/CreateDocket';
import DocketDetail from './pages/dockets/DocketDetail';
import QrScan from './pages/QrScan';
import QrScanner from './pages/QrScanner';
import DocumentView from './pages/DocumentView';
import Users from './pages/Users';
import Departments from './pages/Departments';
import Roles from './pages/Roles';
import Settings from './pages/Settings';
import Registers from './pages/Registers';
import Admin from './pages/Admin';
import DocketTypes from './pages/DocketTypes';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 1,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/qr/:token" element={<QrScan />} />

            {/* Document viewer (full screen, protected) */}
            <Route
              path="/document/:attachmentId"
              element={
                <ProtectedRoute permission="attachment:view">
                  <DocumentView />
                </ProtectedRoute>
              }
            />

            {/* Protected routes */}
            <Route
              element={
                <ProtectedRoute>
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/dockets" element={<DocketsList />} />
              <Route
                path="/dockets/new"
                element={(
                  <ProtectedRoute permission="docket:create">
                    <CreateDocket />
                  </ProtectedRoute>
                )}
              />
              <Route path="/dockets/:id" element={<DocketDetail />} />
              <Route path="/inbox" element={<Inbox />} />
              <Route path="/scan" element={<QrScanner />} />
              <Route
                path="/users"
                element={(
                  <ProtectedRoute permission="user:manage">
                    <Users />
                  </ProtectedRoute>
                )}
              />
              <Route
                path="/departments"
                element={(
                  <ProtectedRoute permission="user:manage">
                    <Departments />
                  </ProtectedRoute>
                )}
              />
              <Route
                path="/roles"
                element={(
                  <ProtectedRoute permission="admin:access">
                    <Roles />
                  </ProtectedRoute>
                )}
              />
              <Route
                path="/docket-types"
                element={(
                  <ProtectedRoute permission="admin:access">
                    <DocketTypes />
                  </ProtectedRoute>
                )}
              />
              <Route
                path="/registers"
                element={(
                  <ProtectedRoute permission="register:manage">
                    <Registers />
                  </ProtectedRoute>
                )}
              />
              <Route path="/profile" element={<Navigate to="/settings?tab=profile" replace />} />
              <Route path="/settings" element={<Settings />} />
              <Route
                path="/admin"
                element={(
                  <ProtectedRoute permission="admin:access">
                    <Admin />
                  </ProtectedRoute>
                )}
              />
            </Route>

            {/* Redirect root to dashboard */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />

            {/* 404 */}
            <Route
              path="*"
              element={
                <div className="min-h-screen flex items-center justify-center">
                  <div className="text-center">
                    <h1 className="text-4xl font-bold mb-2">404</h1>
                    <p className="text-muted-foreground mb-4">Page not found</p>
                    <a href="/dashboard" className="text-primary hover:underline">
                      Go to Dashboard
                    </a>
                  </div>
                </div>
              }
            />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;

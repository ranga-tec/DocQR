import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { AuthProvider } from "@/context/AuthContext"
import { LoginPage } from "@/pages/Login"
import { DashboardLayout } from "@/layouts/DashboardLayout"
import { Dashboard } from "@/pages/Dashboard"
import { DocumentsPage } from "@/pages/Documents"
import { UsersPage } from "@/pages/Users"
import { QRScannerPage } from "@/pages/Scanner"
import { CategoriesPage } from "@/pages/Categories"
import { ProtectedRoute, AdminRoute } from "@/components/ProtectedRoute"

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />

            <Route element={<ProtectedRoute />}>
              <Route path="/" element={<DashboardLayout />}>
                <Route index element={<Dashboard />} />
                <Route path="documents" element={<DocumentsPage />} />
                <Route path="scan" element={<QRScannerPage />} />
                <Route path="categories" element={<CategoriesPage />} />
                <Route path="settings" element={<div className="p-8">Settings (Coming Soon)</div>} />

                <Route element={<AdminRoute />}>
                  <Route path="admin/users" element={<UsersPage />} />
                </Route>
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App

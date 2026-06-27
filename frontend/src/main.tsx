import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './components/common/Toast';
import { Layout } from './components/common/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { FileManager } from './pages/FileManager';
import { DisasterRecovery } from './pages/DisasterRecovery';
import { AdminPanel } from './pages/AdminPanel';
import { UserManagement } from './pages/UserManagement';
import { SecureShare } from './pages/SecureShare';
import './index.css';

// React Query Client initialization
const queryClient = new QueryClient();

// Route Guard for authenticated profiles
const PrivateRoute: React.FC<{ children: React.ReactNode; requireAdmin?: boolean }> = ({ 
  children, 
  requireAdmin = false 
}) => {
  const { isAuthenticated, loading, user } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen w-screen bg-slate-950 flex items-center justify-center">
        <div className="h-6 w-32 bg-slate-800 rounded animate-pulse" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requireAdmin && user?.role !== 'ADMIN') {
    return <Navigate to="/" replace />;
  }

  return <Layout>{children}</Layout>;
};

// Root Router setup
const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Authorization paths */}
        <Route path="/login" element={<Login />} />
        
        {/* Public shared download endpoint */}
        <Route path="/share/:token" element={<SecureShare />} />

        {/* Private Dashboard & Operations */}
        <Route path="/" element={
          <PrivateRoute>
            <Dashboard />
          </PrivateRoute>
        } />
        
        <Route path="/vault" element={
          <PrivateRoute>
            <FileManager />
          </PrivateRoute>
        } />

        <Route path="/recovery" element={
          <PrivateRoute>
            <DisasterRecovery />
          </PrivateRoute>
        } />

        {/* Admin Dashboard */}
        <Route path="/admin" element={
          <PrivateRoute requireAdmin>
            <AdminPanel />
          </PrivateRoute>
        } />
        
        <Route path="/admin/users" element={
          <PrivateRoute requireAdmin>
            <UserManagement />
          </PrivateRoute>
        } />

        {/* Catch-all Redirect */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>
  </React.StrictMode>
);

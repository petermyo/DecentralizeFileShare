import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import MainLayout from './pages/MainLayout';
import AdminLayout from './pages/AdminLayout';
import LoginScreen from './pages/LoginScreen';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminUsers from './pages/admin/AdminUsers';
import AdminUserDetail from './pages/admin/AdminUserDetail';
import AdminFiles from './pages/admin/AdminFiles';
import AdminLists from './pages/admin/AdminLists';

const PrivateRoute = ({ children }) => {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div>Loading...</div>;
  return user ? children : <Navigate to="/" />;
};

const AdminRoute = ({ children }) => {
    const { user, isAdmin } = useAuth();
    if (isLoading) return <div>Loading...</div>;
    return user && isAdmin ? children : <Navigate to="/" />;
}

function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<LoginWrapper />} />
            <Route path="/dashboard" element={<PrivateRoute><MainLayout /></PrivateRoute>} />
            
            <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
              <Route index element={<AdminDashboard />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="users/:userId" element={<AdminUserDetail />} />
              <Route path="files" element={<AdminFiles />} />
              <Route path="lists" element={<AdminLists />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </ThemeProvider>
    </AuthProvider>
  );
}

const LoginWrapper = () => {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  return user ? <Navigate to="/dashboard" /> : <LoginScreen />;
};

export default App;

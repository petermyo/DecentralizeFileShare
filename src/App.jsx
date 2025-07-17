
// --- /src/App.jsx ---
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { DataProvider } from './contexts/DataContext';
import { ThemeProvider } from './contexts/ThemeContext';
import MainLayout from './pages/MainLayout';
import LoginScreen from './pages/LoginScreen';
import UserSettings from './pages/UserSettings';
import AdminLayout from './pages/admin/AdminLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminUsers from './pages/admin/AdminUsers';
import AdminUserDetail from './pages/admin/AdminUserDetail';
import AdminFiles from './pages/admin/AdminFiles';
import AdminLists from './pages/admin/AdminLists';

const PrivateRoute = ({ children }) => {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  return user ? children : <Navigate to="/" />;
};

const AdminRoute = ({ children }) => {
    const { user, isAdmin, isLoading } = useAuth();
    if (isLoading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
    return user && isAdmin ? children : <Navigate to="/" />;
}

function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <DataProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<LoginWrapper />} />
              <Route path="/dashboard" element={<PrivateRoute><MainLayout /></PrivateRoute>} />
              <Route path="/settings" element={<PrivateRoute><UserSettings /></PrivateRoute>} />
              
              <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
                <Route index element={<AdminDashboard />} />
                <Route path="users" element={<AdminUsers />} />
                <Route path="users/:userId" element={<AdminUserDetail />} />
                <Route path="files" element={<AdminFiles />} />
                <Route path="lists" element={<AdminLists />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </DataProvider>
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

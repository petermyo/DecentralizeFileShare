// --- /src/main.jsx ---
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// --- /src/index.css ---
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --color-primary: #0ea5e9; /* sky-500 */
  --color-secondary: #0284c7; /* sky-600 */
  --color-accent: #f0f9ff; /* sky-50 */
}

.theme-pink {
  --color-primary: #ec4899;
  --color-secondary: #db2777;
  --color-accent: #fce7f3;
}

.theme-green {
  --color-primary: #22c55e;
  --color-secondary: #16a34a;
  --color-accent: #f0fdf4;
}

.theme-glamorous {
  --color-primary: #d946ef;
  --color-secondary: #c026d3;
  --color-accent: #fae8ff;
}


// --- /src/App.jsx ---
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import MainLayout from './pages/MainLayout';
import AdminLayout from './pages/AdminLayout';
import LoginScreen from './pages/LoginScreen';
import UserDashboard from './pages/UserDashboard';
import UserSettings from './pages/UserSettings';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminUsers from './pages/admin/AdminUsers';
import AdminUserDetail from './pages/admin/AdminUserDetail';

const PrivateRoute = ({ children }) => {
  const { user } = useAuth();
  return user ? children : <Navigate to="/" />;
};

function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<LoginWrapper />} />
            <Route path="/dashboard" element={<PrivateRoute><UserDashboard /></PrivateRoute>} />
            <Route path="/settings" element={<PrivateRoute><UserSettings /></PrivateRoute>} />
            <Route path="/admin" element={<PrivateRoute><AdminLayout /></PrivateRoute>}>
              <Route index element={<AdminDashboard />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="users/:userId" element={<AdminUserDetail />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </ThemeProvider>
    </AuthProvider>
  );
}

const LoginWrapper = () => {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div>Loading...</div>;
  return user ? <Navigate to="/dashboard" /> : <LoginScreen />;
};

export default App;


// --- /src/contexts/AuthContext.jsx ---
import React, { createContext, useState, useEffect, useContext } from 'react';

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkUserStatus = async () => {
      try {
        const response = await fetch('/api/me');
        if (response.ok) {
          const data = await response.json();
          setUser(data);
        }
      } catch (err) {
        console.error("Failed to check user status:", err);
      } finally {
        setIsLoading(false);
      }
    };
    checkUserStatus();
  }, []);

  const value = { user, setUser, isLoading };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// --- /src/contexts/ThemeContext.jsx ---
import React, { createContext, useState, useEffect, useContext } from 'react';

const ThemeContext = createContext();

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState('theme-default');

  useEffect(() => {
    // In a real app, you would fetch and apply the user's saved theme from the backend
    document.body.className = theme;
  }, [theme]);

  const applyTheme = (themeName) => {
    document.body.className = '';
    document.body.classList.add(themeName);
    setTheme(themeName);
    // In a real app, you would also save this preference to the backend
  };

  return (
    <ThemeContext.Provider value={{ theme, applyTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

// --- /src/pages/LoginScreen.jsx ---
// This is a simplified version. You can copy your more detailed landing page here.
import React from 'react';

const LoginScreen = () => {
  return (
    <div className="text-center max-w-4xl mx-auto mt-10 md:mt-16 p-8 animate-fade-in">
        <h1 className="text-6xl md:text-8xl font-bold text-theme-primary mb-4 tracking-tighter">ဒီဖိုင်</h1>
        <h2 className="text-2xl md:text-3xl font-medium text-slate-700 mb-6">Your Files, Your Privacy, Your Drive.</h2>
        <a href="/api/auth/google/login" className="inline-block bg-theme-primary hover:bg-theme-secondary text-white font-bold py-4 px-10 rounded-lg transition duration-300 ease-in-out transform hover:scale-105 text-lg shadow-xl hover:shadow-2xl">
          Login with Google & Share Instantly
        </a>
    </div>
  );
};

export default LoginScreen;

// --- /src/pages/UserDashboard.jsx ---
// This will contain the main layout with UploadForm, FileTable, etc.
// For brevity, this is a placeholder. You would move your existing components here.
import React from 'react';
import Header from '../components/layout/Header';

const UserDashboard = () => {
    return (
        <div>
            <Header />
            <main className="container mx-auto p-4">
                <h1>Your Dashboard</h1>
                {/* Your UploadForm and FileTable components would go here */}
            </main>
        </div>
    );
};

export default UserDashboard;

// --- /src/components/layout/Header.jsx ---
import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Link } from 'react-router-dom';

const Header = () => {
    const { user } = useAuth();
    const [dropdownOpen, setDropdownOpen] = useState(false);

    return (
        <header className="bg-theme-primary shadow-lg sticky top-0 z-40">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center h-16">
                 <div className="flex items-center space-x-3">
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                    <h1 className="text-xl font-bold text-white">ဒီဖိုင်</h1>
                </div>
                {user && (
                     <div className="relative">
                        <button onClick={() => setDropdownOpen(!dropdownOpen)} className="flex items-center space-x-2">
                             <img className="h-8 w-8 rounded-full ring-2 ring-white" src={user.picture} alt="Profile" />
                        </button>
                        {dropdownOpen && (
                            <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50">
                                <Link to="/settings" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Settings</Link>
                                <a href="/api/logout" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Logout</a>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </header>
    );
};

export default Header;

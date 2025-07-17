// --- /src/contexts/AuthContext.jsx ---
import React, { createContext, useState, useEffect, useContext } from 'react';

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const checkUserStatus = async () => {
      try {
        const response = await fetch('/api/me');
        if (response.ok) {
          const data = await response.json();
          setUser(data);
          // After getting user, check if they are an admin
          const adminCheckResponse = await fetch('/api/admin/check');
          if (adminCheckResponse.ok) {
              setIsAdmin(true);
          }
        }
      } catch (err) {
        console.error("Failed to check user status:", err);
      } finally {
        setIsLoading(false);
      }
    };

  useEffect(() => {
    checkUserStatus();
  }, []);

  const value = { user, setUser, isLoading, isAdmin, refreshAuth: checkUserStatus };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

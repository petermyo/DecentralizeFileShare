import React, { createContext, useState, useEffect, useContext } from 'react';

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  // FIX: Add isAdmin state for admin panel authorization
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const checkUserStatus = async () => {
      try {
        const response = await fetch('/api/me');
        if (response.ok) {
          const data = await response.json();
          setUser(data);
          // Check if the user is an admin after fetching their data
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
    checkUserStatus();
  }, []);

  const value = { user, setUser, isLoading, isAdmin };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

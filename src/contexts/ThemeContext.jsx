// --- /src/contexts/ThemeContext.jsx ---
import React, { createContext, useState, useEffect, useContext } from 'react';

const ThemeContext = createContext();

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState('theme-default');

  useEffect(() => {
    // In a real app, you would fetch and apply the user's saved theme from the backend
    document.body.className = ''; // Clear previous theme classes
    document.body.classList.add(theme);
  }, [theme]);

  const applyTheme = (themeName) => {
    setTheme(themeName);
    // In a real app, you would also save this preference to the backend
  };

  return (
    <ThemeContext.Provider value={{ theme, applyTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

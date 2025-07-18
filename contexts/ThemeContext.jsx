// --- /src/contexts/ThemeContext.jsx ---
import React, { createContext, useState, useEffect, useContext } from 'react';

const ThemeContext = createContext();
export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState('theme-default');
  useEffect(() => {
    document.body.className = '';
    document.body.classList.add(theme);
  }, [theme]);
  const applyTheme = (themeName) => setTheme(themeName);
  return <ThemeContext.Provider value={{ theme, applyTheme }}>{children}</ThemeContext.Provider>;
};

import React, { createContext, useContext, useState, useEffect } from 'react';

interface PasswordContextType {
  isAuthenticated: boolean;
  login: (password: string) => boolean;
  logout: () => void;
}

const PasswordContext = createContext<PasswordContextType | undefined>(undefined);

export const PasswordProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Limpiar el localStorage antiguo para que no inicie sesión automáticamente
    localStorage.removeItem('roca2026_auth');
    
    const storedAuth = sessionStorage.getItem('roca2026_auth');
    if (storedAuth === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  const login = (password: string) => {
    if (password === 'Taladro123') {
      setIsAuthenticated(true);
      sessionStorage.setItem('roca2026_auth', 'true');
      return true;
    }
    return false;
  };

  const logout = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem('roca2026_auth');
  };

  return (
    <PasswordContext.Provider value={{ isAuthenticated, login, logout }}>
      {children}
    </PasswordContext.Provider>
  );
};

export const usePassword = () => {
  const context = useContext(PasswordContext);
  if (context === undefined) {
    throw new Error('usePassword must be used within a PasswordProvider');
  }
  return context;
};

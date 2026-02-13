import React, { createContext, useState, useContext } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);

  const login = (userData) => {
    setUser(userData);
    // In a real app, you'd also save this to localStorage to keep the user logged in
  };

  const logout = () => {
    setUser(null);
    // Also clear from localStorage
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to easily use the auth context
export const useAuth = () => {
  return useContext(AuthContext);
};
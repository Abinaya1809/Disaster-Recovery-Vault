import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

export interface User {
  id: string;
  email: string;
  role: 'ADMIN' | 'EMPLOYEE';
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, role?: 'ADMIN' | 'EMPLOYEE') => Promise<void>;
  logout: () => void;
  forgotPassword: (email: string) => Promise<string>;
  resetPassword: (email: string, pass: string) => Promise<string>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Initialize Auth state from local storage token
  useEffect(() => {
    const initializeUser = () => {
      const accessToken = localStorage.getItem('accessToken');
      if (accessToken) {
        try {
          // Quick parse client-side JWT payload (no signature validation, backend handles validation)
          const base64Url = accessToken.split('.')[1];
          const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
          const jsonPayload = decodeURIComponent(
            window
              .atob(base64)
              .split('')
              .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
              .join('')
          );
          setUser(JSON.parse(jsonPayload));
        } catch (e) {
          console.error('Failed to parse active user payload', e);
          logout();
        }
      }
      setLoading(false);
    };

    initializeUser();

    // Listen to token interceptor logouts
    const handleForceLogout = () => {
      setUser(null);
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
    };
    window.addEventListener('auth-logout', handleForceLogout);

    return () => window.removeEventListener('auth-logout', handleForceLogout);
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const res = await api.post('/auth/login', { email, password });
      const { accessToken, refreshToken, user: loggedUser } = res.data;
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
      setUser(loggedUser);
    } catch (err: any) {
      throw new Error(err.response?.data?.error || 'Login failed. Please check credentials.');
    }
  };

  const register = async (email: string, password: string, role?: 'ADMIN' | 'EMPLOYEE') => {
    try {
      const res = await api.post('/auth/register', { email, password, role });
      const { accessToken, refreshToken, user: registeredUser } = res.data;
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
      setUser(registeredUser);
    } catch (err: any) {
      throw new Error(err.response?.data?.error || 'Registration failed.');
    }
  };

  const logout = () => {
    api.post('/auth/logout').catch(() => {}); // fire and forget
    setUser(null);
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  };

  const forgotPassword = async (email: string) => {
    try {
      const res = await api.post('/auth/forgot-password', { email });
      return res.data.message;
    } catch (err: any) {
      throw new Error(err.response?.data?.error || 'Forgot password failed');
    }
  };

  const resetPassword = async (email: string, pass: string) => {
    try {
      const res = await api.post('/auth/reset-password', { email, newPassword: pass });
      return res.data.message;
    } catch (err: any) {
      throw new Error(err.response?.data?.error || 'Reset password failed');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        loading,
        login,
        register,
        logout,
        forgotPassword,
        resetPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
export default AuthContext;

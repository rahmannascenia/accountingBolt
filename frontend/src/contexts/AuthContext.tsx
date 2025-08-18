import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authAPI, handleApiError } from '../utils/api';
import type { AuthUser, LoginRequest, User } from '../types';

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  isAuthenticated: boolean;
  hasRole: (role: string | string[]) => boolean;
  canAccessAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Initialize auth state
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const token = localStorage.getItem('token');
        const storedUser = localStorage.getItem('user');

        if (token && storedUser) {
          const userData = JSON.parse(storedUser);
          setUser(userData);
          
          // Verify token is still valid by fetching user info
          try {
            await authAPI.me();
          } catch (error) {
            // Token is invalid, clear storage
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            setUser(null);
          }
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const login = async (credentials: LoginRequest) => {
    try {
      setLoading(true);
      const response = await authAPI.login(credentials);
      
      // Store token and user info
      localStorage.setItem('token', response.token);
      localStorage.setItem('user', JSON.stringify(response.user));
      setUser(response.user);
    } catch (error) {
      console.error('Login error:', error);
      throw new Error(handleApiError(error));
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      // Call logout endpoint to invalidate token on server side if needed
      await authAPI.logout().catch(() => {
        // Ignore logout errors, we'll clear local storage anyway
      });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear local storage
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setUser(null);
      
      // Redirect to login
      window.location.href = '/login';
    }
  };

  const refreshUser = async () => {
    try {
      const userData = await authAPI.me();
      const authUser: AuthUser = {
        id: userData.id,
        email: userData.email,
        first_name: userData.first_name,
        last_name: userData.last_name,
        role: userData.role
      };
      
      localStorage.setItem('user', JSON.stringify(authUser));
      setUser(authUser);
    } catch (error) {
      console.error('Refresh user error:', error);
      logout();
    }
  };

  const hasRole = (role: string | string[]): boolean => {
    if (!user) return false;
    
    const roles = Array.isArray(role) ? role : [role];
    return roles.includes(user.role);
  };

  const canAccessAdmin = (): boolean => {
    return hasRole(['admin', 'manager']);
  };

  const value: AuthContextType = {
    user,
    loading,
    login,
    logout,
    refreshUser,
    isAuthenticated: !!user,
    hasRole,
    canAccessAdmin: canAccessAdmin()
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from '../types/index';
import { api, setStoredToken, removeStoredToken, getStoredToken } from '../services/api';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, role?: UserRole) => Promise<boolean>;
  logout: () => void;
  hasRole: (...roles: UserRole[]) => boolean;
  canManageUsers: boolean;
  canManageFinances: boolean;
  canRecordCollection: boolean;
  canManageStaff: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const token = getStoredToken();
      if (token) {
        try {
          const res = await api.getMe();
          if (res.success && res.user) {
            setUser(res.user);
          }
        } catch (e) {
          console.warn('Session expired or invalid token', e);
          removeStoredToken();
        }
      } else {
        // Auto-login default Admin for seamless viewing
        try {
          const res = await api.login('admin@madinastreet.org', 'Administrator');
          if (res.success) {
            setStoredToken(res.token);
            setUser(res.user);
          }
        } catch (err) {
          console.error('Auto login fallback failed', err);
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const login = async (email: string, role?: UserRole): Promise<boolean> => {
    try {
      const res = await api.login(email, role);
      if (res.success && res.user) {
        setStoredToken(res.token);
        setUser(res.user);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Login error:', err);
      return false;
    }
  };

  const logout = () => {
    removeStoredToken();
    setUser(null);
  };

  const hasRole = (...roles: UserRole[]): boolean => {
    if (!user) return false;
    return roles.includes(user.role);
  };

  const canManageUsers = user?.role === 'Administrator';
  const canManageFinances = user?.role === 'Administrator' || user?.role === 'Treasurer';
  const canRecordCollection = user?.role === 'Administrator' || user?.role === 'Treasurer' || user?.role === 'Collector';
  const canManageStaff = user?.role === 'Administrator' || user?.role === 'Treasurer';

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        hasRole,
        canManageUsers,
        canManageFinances,
        canRecordCollection,
        canManageStaff,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

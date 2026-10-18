import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, LoginResponse } from '../types/api';
import { api, getStoredToken, getStoredUser, setStoredAuth, clearStoredAuth } from '../services/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  hasPermission: (permission: string) => boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Default role permissions matrix fallback
const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
  '1': ['*'],
  'administrador': ['*'],
  'admin': ['*'],
  '2': [
    'Dashboard.View', 'WorkOrders.View', 'WorkOrders.Create', 'WorkOrders.Update', 'WorkOrders.Cancel', 'WorkOrders.ChangeStatus', 'WorkOrders.Approve', 'WorkOrders.Convert', 'WorkOrders.Print',
    'Sales.View', 'Sales.Create', 'Sales.Cancel', 'Sales.Print',
    'Customers.View', 'Customers.Create', 'Customers.Update',
    'Bicycles.View', 'Bicycles.Create', 'Bicycles.Update',
    'Products.View', 'Products.Create', 'Products.Update',
    'Services.View', 'Services.Create', 'Services.Update',
    'Suppliers.View', 'Suppliers.Create', 'Suppliers.Update',
    'Stock.View', 'Stock.Adjust',
    'Reports.View',
    'WorkshopSettings.View', 'WorkshopSettings.Update',
    'Users.View'
  ],
  'gerente': [
    'Dashboard.View', 'WorkOrders.View', 'WorkOrders.Create', 'WorkOrders.Update', 'WorkOrders.Cancel', 'WorkOrders.ChangeStatus', 'WorkOrders.Approve', 'WorkOrders.Convert', 'WorkOrders.Print',
    'Sales.View', 'Sales.Create', 'Sales.Cancel', 'Sales.Print',
    'Customers.View', 'Customers.Create', 'Customers.Update',
    'Bicycles.View', 'Bicycles.Create', 'Bicycles.Update',
    'Products.View', 'Products.Create', 'Products.Update',
    'Services.View', 'Services.Create', 'Services.Update',
    'Suppliers.View', 'Suppliers.Create', 'Suppliers.Update',
    'Stock.View', 'Stock.Adjust',
    'Reports.View',
    'WorkshopSettings.View', 'WorkshopSettings.Update',
    'Users.View'
  ],
  '3': [
    'Dashboard.View', 'Customers.View', 'Customers.Create', 'Customers.Update',
    'Bicycles.View', 'Bicycles.Create', 'Bicycles.Update',
    'Products.View', 'Services.View',
    'WorkOrders.View', 'WorkOrders.Create', 'WorkOrders.Update', 'WorkOrders.Print',
    'Sales.View', 'Sales.Create', 'Sales.Print',
    'Stock.View', 'WorkshopSettings.View'
  ],
  'atendente': [
    'Dashboard.View', 'Customers.View', 'Customers.Create', 'Customers.Update',
    'Bicycles.View', 'Bicycles.Create', 'Bicycles.Update',
    'Products.View', 'Services.View',
    'WorkOrders.View', 'WorkOrders.Create', 'WorkOrders.Update', 'WorkOrders.Print',
    'Sales.View', 'Sales.Create', 'Sales.Print',
    'Stock.View', 'WorkshopSettings.View'
  ],
  '4': [
    'Dashboard.View', 'Customers.View', 'Bicycles.View', 'Products.View',
    'Services.View', 'WorkOrders.View', 'WorkOrders.Update', 'WorkOrders.ChangeStatus',
    'WorkOrders.Print', 'Stock.View', 'WorkshopSettings.View'
  ],
  'mecanico': [
    'Dashboard.View', 'Customers.View', 'Bicycles.View', 'Products.View',
    'Services.View', 'WorkOrders.View', 'WorkOrders.Update', 'WorkOrders.ChangeStatus',
    'WorkOrders.Print', 'Stock.View', 'WorkshopSettings.View'
  ],
  '5': [
    'Dashboard.View', 'Customers.View', 'WorkOrders.View', 'Sales.View',
    'Sales.Create', 'Sales.Print', 'Reports.View'
  ],
  'financeiro': [
    'Dashboard.View', 'Customers.View', 'WorkOrders.View', 'Sales.View',
    'Sales.Create', 'Sales.Print', 'Reports.View'
  ]
};

const ROLE_NAMES_BY_ID: Record<number, string> = {
  1: 'Administrador',
  2: 'Gerente',
  3: 'Atendente',
  4: 'Mecânico',
  5: 'Financeiro'
};

function ensureUserPermissions(userData: User | null): User | null {
  if (!userData) return null;

  // Infer missing roleName if roleId is known
  let roleName = userData.roleName;
  if (!roleName && userData.roleId && ROLE_NAMES_BY_ID[userData.roleId]) {
    roleName = ROLE_NAMES_BY_ID[userData.roleId];
  }

  const normRole = (roleName || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

  // Admin always has wildcard
  if (userData.roleId === 1 || normRole === 'administrador' || normRole === 'admin') {
    return {
      ...userData,
      roleName: roleName || 'Administrador',
      permissions: (userData.permissions && userData.permissions.length > 0) ? userData.permissions : ['*']
    };
  }

  if (!userData.permissions || !Array.isArray(userData.permissions) || userData.permissions.length === 0) {
    const defaults = DEFAULT_ROLE_PERMISSIONS[normRole] || DEFAULT_ROLE_PERMISSIONS[String(userData.roleId)] || [];
    const fallbackPerms = defaults.length > 0
      ? defaults
      : ['Dashboard.View', 'WorkOrders.View', 'Customers.View', 'Bicycles.View', 'Products.View', 'Services.View', 'Stock.View'];
    return {
      ...userData,
      roleName: roleName || 'Colaborador',
      permissions: fallbackPerms
    };
  }

  return {
    ...userData,
    roleName: roleName || userData.roleName || 'Colaborador'
  };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => ensureUserPermissions(getStoredUser()));
  const [token, setToken] = useState<string | null>(getStoredToken());
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshUser = useCallback(async () => {
    try {
      const storedToken = getStoredToken();
      if (!storedToken) {
        setUser(null);
        setToken(null);
        return;
      }
      const currentUser = await api.get<User>('/Auth/me');
      const preparedUser = ensureUserPermissions(currentUser);
      setUser(preparedUser);
      if (preparedUser && storedToken) {
        setStoredAuth(storedToken, preparedUser);
      }
    } catch (err: any) {
      console.warn('Failed to refresh user', err);
      if (err?.status === 401 || err?.message?.includes('401') || err?.message?.includes('autorizado')) {
        clearStoredAuth();
        setUser(null);
        setToken(null);
      } else {
        // If error occurs, keep cached user with guaranteed permissions
        setUser((prev) => ensureUserPermissions(prev));
      }
    }
  }, []);

  useEffect(() => {
    const handleUnauthorized = () => {
      clearStoredAuth();
      setUser(null);
      setToken(null);
    };

    window.addEventListener('auth:unauthorized', handleUnauthorized);

    const init = async () => {
      const storedToken = getStoredToken();
      const storedUser = getStoredUser();
      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(ensureUserPermissions(storedUser));
        await refreshUser();
      } else if (storedToken) {
        setToken(storedToken);
        await refreshUser();
      } else {
        // No stored token, user must login
        setUser(null);
        setToken(null);
      }
      setIsLoading(false);
    };

    init();

    return () => {
      window.removeEventListener('auth:unauthorized', handleUnauthorized);
    };
  }, [refreshUser]);

  const login = async (username: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await api.post<LoginResponse>('/Auth/login', { username, password });
      const preparedUser = ensureUserPermissions(res.user);
      setStoredAuth(res.accessToken, preparedUser);
      setToken(res.accessToken);
      setUser(preparedUser);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    clearStoredAuth();
    setUser(null);
    setToken(null);
  };

  const hasPermission = useCallback((permission: string): boolean => {
    if (!user) return false;

    const normRole = (user.roleName || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();

    // 1. Admin or wildcard has access to everything
    if (
      user.roleId === 1 ||
      normRole === 'administrador' ||
      normRole === 'admin' ||
      user.permissions?.includes('*')
    ) {
      return true;
    }

    const targetPerm = (permission || '').toLowerCase().trim();
    if (!targetPerm) return false;
    const targetClean = targetPerm.replace(/[^a-z0-9]/g, '');

    // Every authenticated user has basic dashboard view access
    if (targetClean === 'dashboardview') {
      return true;
    }

    // 2. Direct check on user permissions array (case, accent, and punctuation insensitive)
    if (Array.isArray(user.permissions) && user.permissions.length > 0) {
      if (user.permissions.includes('*')) return true;
      const match = user.permissions.some((p) => {
        if (typeof p !== 'string') return false;
        const normP = p.toLowerCase().trim();
        return normP === targetPerm || normP.replace(/[^a-z0-9]/g, '') === targetClean;
      });
      if (match) return true;
    }

    // 3. Role defaults fallback
    const roleKey = normRole || String(user.roleId || '');
    const defaults = DEFAULT_ROLE_PERMISSIONS[roleKey] || DEFAULT_ROLE_PERMISSIONS[String(user.roleId)];
    if (defaults) {
      if (defaults.includes('*')) return true;
      if (defaults.some((p) => {
        const normP = p.toLowerCase().trim();
        return normP === targetPerm || normP.replace(/[^a-z0-9]/g, '') === targetClean;
      })) return true;
    }

    return false;
  }, [user]);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user && !!token,
        isLoading,
        login,
        logout,
        hasPermission,
        refreshUser,
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

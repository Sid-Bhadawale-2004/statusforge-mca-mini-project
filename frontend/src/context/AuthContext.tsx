import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { User, Organization, UserRole } from '../types/index.js';
import { api } from '../services/api.js';

interface AuthContextType {
  user: User | null;
  organization: Organization | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  socket: Socket | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (payload: any) => Promise<void>;
  loginWithGoogle: (credential: string) => Promise<void>;
  acceptInvitation: (token: string, password: string) => Promise<void>;
  logout: () => void;
  switchDemoRole: (role: UserRole) => Promise<void>;
  switchDemoUser: (userId: string) => Promise<void>;
  refreshMe: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('statusforge_token'));
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [socket, setSocket] = useState<Socket | null>(null);

  // Initialize Socket.IO connection
  useEffect(() => {
    const socketInstance = io(window.location.origin, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
    });

    socketInstance.on('connect', () => {
      console.log('[StatusForge Socket] Connected with ID:', socketInstance.id);
    });

    socketInstance.on('connect_error', (err) => {
      console.warn('[StatusForge Socket] Connection warning:', err.message);
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, []);

  // Join organization room when authenticated
  useEffect(() => {
    if (socket && organization?._id) {
      socket.emit('join:org', organization._id);
      return () => {
        socket.emit('leave:org', organization._id);
      };
    }
  }, [socket, organization?._id]);

  // Load session on mount
  useEffect(() => {
    async function loadSession() {
      if (!token) {
        setIsLoading(false);
        return;
      }

      try {
        const data = await api.auth.me();
        setUser(data.user);
        setOrganization(data.organization);
      } catch (error) {
        console.error('[AuthContext] Session expired or invalid:', error);
        localStorage.removeItem('statusforge_token');
        setToken(null);
        setUser(null);
        setOrganization(null);
      } finally {
        setIsLoading(false);
      }
    }

    loadSession();
  }, [token]);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const data = await api.auth.login({ email, password });
      localStorage.setItem('statusforge_token', data.token);
      setToken(data.token);
      setUser(data.user);
      setOrganization(data.organization);
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (payload: any) => {
    setIsLoading(true);
    try {
      const data = await api.auth.signup(payload);
      localStorage.setItem('statusforge_token', data.token);
      setToken(data.token);
      setUser(data.user);
      setOrganization(data.organization);
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithGoogle = async (accessToken: string) => {
    setIsLoading(true);
    try {
      const data = await api.auth.googleAuth({ accessToken });
      localStorage.setItem('statusforge_token', data.token);
      setToken(data.token);
      setUser(data.user);
      setOrganization(data.organization);
    } finally {
      setIsLoading(false);
    }
  };

  const acceptInvitation = async (invitationToken: string, password: string) => {
    setIsLoading(true);
    try {
      const data = await api.auth.acceptInvitation({ token: invitationToken, password });
      localStorage.setItem('statusforge_token', data.token);
      setToken(data.token);
      setUser(data.user);
      setOrganization(data.organization);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('statusforge_token');
    setToken(null);
    setUser(null);
    setOrganization(null);
  };

  const switchDemoRole = async (targetRole: UserRole) => {
    try {
      const data = await api.auth.demoSwitch({ targetRole });
      localStorage.setItem('statusforge_token', data.token);
      setToken(data.token);
      setUser(data.user);
      setOrganization(data.organization);
    } catch (err) {
      console.error('[AuthContext] Demo role switch error:', err);
    }
  };

  const switchDemoUser = async (targetUserId: string) => {
    try {
      const data = await api.auth.demoSwitch({ targetUserId });
      localStorage.setItem('statusforge_token', data.token);
      setToken(data.token);
      setUser(data.user);
      setOrganization(data.organization);
    } catch (err) {
      console.error('[AuthContext] Demo user switch error:', err);
    }
  };

  const refreshMe = async () => {
    try {
      const data = await api.auth.me();
      setUser(data.user);
      setOrganization(data.organization);
    } catch (error) {
      console.error('[AuthContext] Refresh failed:', error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        organization,
        token,
        isLoading,
        isAuthenticated: Boolean(user && token),
        socket,
        login,
        signup,
        loginWithGoogle,
        acceptInvitation,
        logout,
        switchDemoRole,
        switchDemoUser,
        refreshMe,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

import React, { createContext, useContext, useEffect, useState } from "react";
import { apiRequest } from "../api/client";

export type UserRole = "admin" | "agent" | "manager" | "change_manager" | "cab_member" | "requester";

export interface UserProfile {
  id: string;
  login: string;
  email: string;
  role: UserRole;
  profile: Record<string, any>;
  groups?: string[];
  organization_id: string;
}

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  login: (loginVal: string, passwordVal: string) => Promise<UserProfile>;
  logout: () => Promise<void>;
  checkSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const checkSession = async () => {
    try {
      // Call GET /auth/me to verify current cookie session
      const data = await apiRequest<{ user: UserProfile }>("/auth/me");
      setUser(data.user);
    } catch (err) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkSession();
  }, []);

  const login = async (loginVal: string, passwordVal: string): Promise<UserProfile> => {
    setLoading(true);
    try {
      const data = await apiRequest<{ user: UserProfile }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ login: loginVal, password: passwordVal }),
      });
      setUser(data.user);
      return data.user;
    } catch (err) {
      setUser(null);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await apiRequest("/auth/logout", { method: "POST" });
    } catch (err) {
      console.error("Logout request failed:", err);
    } finally {
      setUser(null);
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, checkSession }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

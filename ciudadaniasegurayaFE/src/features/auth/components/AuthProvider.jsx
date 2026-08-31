"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { authService } from "../services/auth.service";
import { subscribeToAccessToken } from "../state/access-token-vault";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState("loading");

  const bootstrap = useCallback(async () => {
    setStatus("loading");
    try {
      setUser(await authService.me());
      setStatus("authenticated");
    } catch {
      setUser(null);
      setStatus("anonymous");
    }
  }, []);

  useEffect(() => {
    const bootstrapTimer = setTimeout(() => void bootstrap(), 0);
    const unsubscribe = subscribeToAccessToken((token) => {
      if (!token) {
        setUser(null);
        setStatus("anonymous");
      }
    });
    return () => {
      clearTimeout(bootstrapTimer);
      unsubscribe();
    };
  }, [bootstrap]);

  const login = useCallback(async (input) => {
    const session = await authService.login(input);
    setUser(session.user);
    setStatus("authenticated");
    return session.user;
  }, []);

  const register = useCallback(async (input) => {
    const session = await authService.register(input);
    setUser(session.user);
    setStatus("authenticated");
    return session.user;
  }, []);

  const logout = useCallback(async () => {
    await authService.logout();
    setUser(null);
    setStatus("anonymous");
  }, []);

  const value = useMemo(
    () => ({
      user,
      status,
      isAuthenticated: status === "authenticated",
      bootstrap,
      login,
      register,
      logout,
    }),
    [user, status, bootstrap, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth debe utilizarse dentro de AuthProvider");
  return value;
}

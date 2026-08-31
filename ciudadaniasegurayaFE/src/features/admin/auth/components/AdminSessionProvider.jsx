"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { ADMIN_SESSION_EXPIRED_EVENT } from "@/lib/api/admin-api-client";

import { adminAuthService } from "../services/admin-auth.service";
import { subscribeToAdminAccessToken } from "../state/admin-access-token-vault";

const AdminSessionContext = createContext(null);

function statusForError(error) {
  if (
    error?.code === "ADMIN_ACCOUNT_SUSPENDED" ||
    error?.code === "ACCOUNT_SUSPENDED"
  ) {
    return "suspended";
  }
  if (
    error?.code === "ADMIN_ROLE_REQUIRED" ||
    error?.code === "INSUFFICIENT_ADMIN_PERMISSION"
  ) {
    return "forbidden";
  }
  return "anonymous";
}

export function AdminSessionProvider({ children, queryClient }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState("loading");

  const resetSession = useCallback(
    (nextStatus = "anonymous") => {
      setUser(null);
      setStatus(nextStatus);
      queryClient?.clear();
    },
    [queryClient],
  );

  const bootstrap = useCallback(async () => {
    setStatus("loading");
    try {
      const current = await adminAuthService.me();
      setUser(current);
      setStatus("authenticated");
      return current;
    } catch (error) {
      resetSession(statusForError(error));
      return null;
    }
  }, [resetSession]);

  useEffect(() => {
    const timer = setTimeout(() => void bootstrap(), 0);
    const unsubscribe = subscribeToAdminAccessToken((token) => {
      if (!token) resetSession("anonymous");
    });
    const expire = () => resetSession("expired");
    window.addEventListener(ADMIN_SESSION_EXPIRED_EVENT, expire);
    return () => {
      clearTimeout(timer);
      unsubscribe();
      window.removeEventListener(ADMIN_SESSION_EXPIRED_EVENT, expire);
    };
  }, [bootstrap, resetSession]);

  const login = useCallback(async (input) => {
    const session = await adminAuthService.login(input);
    setUser(session.user);
    setStatus("authenticated");
    return session.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await adminAuthService.logout();
    } finally {
      resetSession("anonymous");
    }
  }, [resetSession]);

  const logoutAll = useCallback(async () => {
    try {
      await adminAuthService.logoutAll();
    } finally {
      resetSession("anonymous");
    }
  }, [resetSession]);

  const value = useMemo(() => {
    const permissions = new Set(user?.permissions || []);
    return {
      user,
      status,
      isAuthenticated: status === "authenticated",
      permissions,
      hasPermission: (permission) => permissions.has(permission),
      bootstrap,
      login,
      logout,
      logoutAll,
    };
  }, [bootstrap, login, logout, logoutAll, status, user]);

  return (
    <AdminSessionContext.Provider value={value}>
      {children}
    </AdminSessionContext.Provider>
  );
}

export function useAdminSession() {
  const value = useContext(AdminSessionContext);
  if (!value) {
    throw new Error("useAdminSession debe utilizarse dentro de AdminSessionProvider");
  }
  return value;
}

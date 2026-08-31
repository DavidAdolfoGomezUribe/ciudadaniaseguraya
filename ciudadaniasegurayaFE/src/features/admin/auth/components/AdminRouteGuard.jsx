"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { adminRoutes } from "@/lib/navigation/admin-routes";

import { useAdminSession } from "./AdminSessionProvider";

function SessionCheck({ label = "COMPROBANDO SESIÓN ADMINISTRATIVA" }) {
  return (
    <div className="grid min-h-screen place-items-center p-6" role="status">
      <div className="system-panel w-full max-w-md p-6">
        <p className="technical-label pulse-dot mb-3">{label}</p>
        <div className="h-1 overflow-hidden bg-[var(--background-panel)]">
          <div className="scan-line h-full w-1/2 bg-[var(--foreground-primary)]" />
        </div>
      </div>
    </div>
  );
}

export function AdminRouteGuard({ children }) {
  const router = useRouter();
  const { status } = useAdminSession();

  useEffect(() => {
    if (status === "anonymous") router.replace(adminRoutes.login);
    if (status === "expired") {
      router.replace(`${adminRoutes.login}?error=session_expired`);
    }
    if (status === "suspended") {
      router.replace(`${adminRoutes.login}?error=account_suspended`);
    }
    if (status === "forbidden") router.replace("/");
  }, [router, status]);

  if (status === "loading") return <SessionCheck />;
  if (status !== "authenticated") return null;
  return children;
}

export function AdminLoginGate({ children }) {
  const router = useRouter();
  const { status } = useAdminSession();

  useEffect(() => {
    if (status === "authenticated") router.replace(adminRoutes.dashboard);
  }, [router, status]);

  if (status === "loading" || status === "authenticated") {
    return <SessionCheck label="VERIFICANDO ACCESO ADMINISTRATIVO" />;
  }
  return children;
}

"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

import { useAuth } from "./AuthProvider";

export function AuthGate({ children }) {
  const { status } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (status === "anonymous") {
      router.replace(`/login?returnTo=${encodeURIComponent(pathname)}`);
    }
  }, [pathname, router, status]);

  if (status === "loading") {
    return (
      <div
        role="status"
        className="page-grid grid min-h-[50vh] place-items-center py-16"
      >
        <p className="technical-label pulse-dot">COMPROBANDO SESIÓN</p>
      </div>
    );
  }

  if (status !== "authenticated") return null;
  return children;
}

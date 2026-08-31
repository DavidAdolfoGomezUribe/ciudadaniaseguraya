"use client";

import { usePathname } from "next/navigation";

import { isAdministrativePath } from "@/lib/navigation/admin-routes";
import { AdminProviders } from "@/providers/AdminProviders";
import { AppProviders } from "@/providers/AppProviders";

import { Footer } from "./Footer";
import { Header } from "./Header";

export function ApplicationShell({ children }) {
  const pathname = usePathname();

  if (isAdministrativePath(pathname)) {
    return (
      <AdminProviders>
        <main id="contenido-principal" tabIndex="-1">
          {children}
        </main>
      </AdminProviders>
    );
  }

  return (
    <AppProviders>
      <Header />
      <main id="contenido-principal" tabIndex="-1">
        {children}
      </main>
      <Footer />
    </AppProviders>
  );
}

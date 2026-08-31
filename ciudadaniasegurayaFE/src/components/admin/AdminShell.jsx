"use client";

import { useState } from "react";

import { AdminHeader } from "./AdminHeader";
import { AdminSidebar } from "./AdminSidebar";

export function AdminShell({ children }) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className="min-h-screen bg-[var(--background-primary)] lg:grid lg:grid-cols-[18rem_minmax(0,1fr)]">
      <AdminSidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
      <div className="min-w-0">
        <AdminHeader onOpenMenu={() => setMenuOpen(true)} />
        <div className="mx-auto w-full max-w-[1600px] p-4 sm:p-6 lg:p-8">
          {children}
        </div>
      </div>
    </div>
  );
}

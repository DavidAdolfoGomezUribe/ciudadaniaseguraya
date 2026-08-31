"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { adminRoutes } from "@/lib/navigation/admin-routes";
import { classNames } from "@/lib/utils/class-names";

const sections = [
  { href: adminRoutes.users, label: "USUARIOS NORMALES" },
  { href: adminRoutes.administrators, label: "ADMINISTRADORES" },
];

export function UserManagementTabs() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Secciones de gestión de usuarios"
      className="mb-6 flex flex-wrap gap-2 border-b border-[var(--border-primary)] pb-3"
    >
      {sections.map(({ href, label }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={classNames(
              "inline-flex min-h-11 items-center border px-4 font-mono text-xs font-bold tracking-[0.08em] no-underline",
              active
                ? "border-[var(--foreground-primary)] bg-[var(--selection-primary)] text-[var(--selection-foreground)]"
                : "border-[var(--border-soft)] bg-[var(--background-elevated)] hover:border-[var(--border-primary)]",
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

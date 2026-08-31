import { AdminLoginForm } from "@/features/admin/auth/components/AdminLoginForm";
import { AdminLoginGate } from "@/features/admin/auth/components/AdminRouteGuard";
import { ThemeToggle } from "@/features/theme/components/ThemeToggle";

export const metadata = {
  title: "Acceso administrativo",
  description:
    "Área reservada para administradores autorizados de Ciudadanía Segura Ya.",
  robots: { index: false, follow: false },
};

const loginErrors = {
  account_suspended: "La cuenta administrativa está suspendida.",
  session_expired: "La sesión administrativa expiró. Inicia sesión nuevamente.",
};

export default async function AdminLoginPage({ searchParams }) {
  const params = await searchParams;
  return (
    <AdminLoginGate>
      <div className="grid min-h-screen place-items-center p-4 sm:p-8">
        <div className="absolute right-4 top-4">
          <ThemeToggle />
        </div>
        <section className="system-panel w-full max-w-lg p-6 sm:p-9">
          <p className="technical-label mb-3">CSY · CANAL RESTRINGIDO</p>
          <h1 className="mb-3 text-3xl font-semibold sm:text-4xl">
            ACCESO ADMINISTRATIVO
          </h1>
          <p className="mb-7 text-sm leading-6 text-[var(--foreground-secondary)]">
            Área reservada para administradores autorizados de Ciudadanía Segura Ya.
          </p>
          <AdminLoginForm initialError={loginErrors[params?.error]} />
        </section>
      </div>
    </AdminLoginGate>
  );
}

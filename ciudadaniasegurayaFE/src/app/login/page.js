import { AuthPanel } from "@/features/auth/components/AuthPanel";
import { LoginForm } from "@/features/auth/components/LoginForm";
import { safeReturnTo } from "@/features/auth/utils/safe-return-to";

export const metadata = {
  title: "Iniciar sesión",
  description: "Accede a tu cuenta de Ciudadanía Segura Ya.",
};

export default async function LoginPage({ searchParams }) {
  const params = await searchParams;
  const returnTo = safeReturnTo(params?.returnTo);

  return (
    <AuthPanel
      eyebrow="ACCESO · USUARIO"
      title="Iniciar sesión"
      description="Tu sesión permite reportar incidentes y administrar la información básica de tu cuenta."
    >
      <LoginForm returnTo={returnTo} />
    </AuthPanel>
  );
}

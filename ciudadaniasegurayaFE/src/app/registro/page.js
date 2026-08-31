import { AuthPanel } from "@/features/auth/components/AuthPanel";
import { RegisterForm } from "@/features/auth/components/RegisterForm";
import { safeReturnTo } from "@/features/auth/utils/safe-return-to";

export const metadata = {
  title: "Crear cuenta",
  description: "Crea una cuenta en Ciudadanía Segura Ya.",
};

export default async function RegisterPage({ searchParams }) {
  const params = await searchParams;
  const returnTo = safeReturnTo(params?.returnTo);

  return (
    <AuthPanel
      eyebrow="REGISTRO · USUARIO"
      title="Crear cuenta"
      description="Usamos los datos mínimos necesarios para identificar cada aporte y proteger la integridad de la validación comunitaria."
    >
      <RegisterForm returnTo={returnTo} />
    </AuthPanel>
  );
}

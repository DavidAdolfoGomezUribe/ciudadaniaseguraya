"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";

import { FormField } from "@/components/forms/FormField";
import { SubmitStatus } from "@/components/forms/SubmitStatus";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

import { loginSchema } from "../schemas/auth.schema";
import { safeReturnTo } from "../utils/safe-return-to";
import { useAuth } from "./AuthProvider";

export function LoginForm({ returnTo = "/" }) {
  const router = useRouter();
  const { login } = useAuth();
  const [apiError, setApiError] = useState(null);
  const destination = safeReturnTo(returnTo);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: "", password: "" },
  });

  const finishLogin = useCallback(() => {
    router.replace(destination);
    router.refresh();
  }, [destination, router]);

  const submit = handleSubmit(async (values) => {
    setApiError(null);
    try {
      await login(values);
      finishLogin();
    } catch (error) {
      setApiError(error);
    }
  });

  return (
    <form className="grid gap-5" onSubmit={submit} noValidate>
      <FormField
        label="Correo o nombre de usuario"
        htmlFor="identifier"
        required
        error={errors.identifier?.message}
      >
        <Input
          id="identifier"
          autoComplete="username"
          invalid={Boolean(errors.identifier)}
          aria-describedby={errors.identifier ? "identifier-error" : undefined}
          {...register("identifier")}
        />
      </FormField>

      <FormField
        label="Contraseña"
        htmlFor="password"
        required
        error={errors.password?.message}
      >
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          invalid={Boolean(errors.password)}
          aria-describedby={errors.password ? "password-error" : undefined}
          {...register("password")}
        />
      </FormField>

      <SubmitStatus error={apiError} />

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "VALIDANDO ACCESO" : "INICIAR SESIÓN"}
      </Button>

      <p className="mb-0 text-center text-sm">
        ¿Aún no tienes cuenta?{" "}
        <Link
          className="font-semibold underline"
          href={`/registro?returnTo=${encodeURIComponent(destination)}`}
        >
          Crear cuenta
        </Link>
      </p>
    </form>
  );
}

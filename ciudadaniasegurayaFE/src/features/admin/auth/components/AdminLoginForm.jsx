"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { FormField } from "@/components/forms/FormField";
import { SubmitStatus } from "@/components/forms/SubmitStatus";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { adminRoutes } from "@/lib/navigation/admin-routes";

import { adminLoginSchema } from "../schemas/admin-auth.schema";
import { useAdminSession } from "./AdminSessionProvider";

function publicAdminError(error) {
  if (
    error?.code === "ADMIN_ROLE_REQUIRED" ||
    error?.code === "INSUFFICIENT_ADMIN_PERMISSION"
  ) {
    return Object.assign(new Error("Esta cuenta no tiene permisos administrativos."), {
      requestId: error.requestId,
    });
  }
  if (error?.status === 429) {
    return Object.assign(
      new Error("Demasiados intentos. Intenta nuevamente más tarde."),
      {
        requestId: error.requestId,
      },
    );
  }
  if (
    error?.code === "ADMIN_ACCOUNT_SUSPENDED" ||
    error?.code === "ACCOUNT_SUSPENDED"
  ) {
    return Object.assign(new Error("La cuenta administrativa está suspendida."), {
      requestId: error.requestId,
    });
  }
  if (error?.status === 401) {
    return Object.assign(
      new Error("Las credenciales administrativas no son válidas."),
      { requestId: error.requestId },
    );
  }
  return error;
}

export function AdminLoginForm({ initialError }) {
  const router = useRouter();
  const { login } = useAdminSession();
  const [showPassword, setShowPassword] = useState(false);
  const [apiError, setApiError] = useState(
    initialError ? new Error(initialError) : null,
  );
  const {
    register,
    handleSubmit,
    resetField,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(adminLoginSchema),
    defaultValues: { identifier: "", password: "" },
  });

  const submit = handleSubmit(async (values) => {
    setApiError(null);
    try {
      await login(values);
      resetField("password");
      router.replace(adminRoutes.dashboard);
      router.refresh();
    } catch (error) {
      resetField("password");
      setApiError(publicAdminError(error));
    }
  });

  return (
    <form className="grid gap-5" onSubmit={submit} noValidate>
      <FormField
        label="Correo o nombre de usuario"
        htmlFor="admin-identifier"
        required
        error={errors.identifier?.message}
      >
        <Input
          id="admin-identifier"
          autoComplete="username"
          maxLength={254}
          invalid={Boolean(errors.identifier)}
          aria-describedby={errors.identifier ? "admin-identifier-error" : undefined}
          {...register("identifier")}
        />
      </FormField>

      <FormField
        label="Contraseña"
        htmlFor="admin-password"
        required
        error={errors.password?.message}
      >
        <div className="relative">
          <Input
            id="admin-password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            maxLength={128}
            className="pr-14"
            invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? "admin-password-error" : undefined}
            {...register("password")}
          />
          <button
            type="button"
            className="absolute inset-y-0 right-0 grid min-w-12 place-items-center border-l border-[var(--border-soft)]"
            aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
            aria-pressed={showPassword}
            onClick={() => setShowPassword((value) => !value)}
          >
            {showPassword ? (
              <EyeOff size={18} aria-hidden="true" />
            ) : (
              <Eye size={18} aria-hidden="true" />
            )}
          </button>
        </div>
      </FormField>

      <SubmitStatus error={apiError} />

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "VALIDANDO CREDENCIALES" : "INGRESAR AL PANEL"}
      </Button>

      <div className="border-l-4 border-[var(--accent-information)] bg-[var(--surface-information)] p-3 text-sm">
        <p className="mb-0 flex items-start gap-2">
          <ShieldAlert className="mt-0.5 shrink-0" size={17} aria-hidden="true" />
          Los accesos y acciones administrativas quedan registrados por motivos de
          seguridad y auditoría.
        </p>
      </div>

      <Link className="text-center text-sm font-semibold underline" href="/">
        Volver al sitio público
      </Link>
    </form>
  );
}

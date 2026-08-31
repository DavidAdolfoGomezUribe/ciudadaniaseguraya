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

import { registerSchema } from "../schemas/auth.schema";
import { safeReturnTo } from "../utils/safe-return-to";
import { useAuth } from "./AuthProvider";

export function RegisterForm({ returnTo = "/" }) {
  const router = useRouter();
  const { register: createAccount } = useAuth();
  const [apiError, setApiError] = useState(null);
  const destination = safeReturnTo(returnTo);
  const {
    register,
    handleSubmit,
    resetField,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: "",
      email: "",
      password: "",
      confirmPassword: "",
      acceptTerms: false,
    },
  });

  const finishRegistration = useCallback(() => {
    router.replace(destination);
    router.refresh();
  }, [destination, router]);

  const submit = handleSubmit(async (values) => {
    setApiError(null);
    try {
      await createAccount({
        username: values.username,
        email: values.email,
        password: values.password,
      });
      resetField("password");
      resetField("confirmPassword");
      finishRegistration();
    } catch (error) {
      resetField("password");
      resetField("confirmPassword");
      setApiError(error);
    }
  });

  return (
    <form className="grid gap-5" onSubmit={submit} noValidate>
      <FormField
        label="Nombre de usuario"
        htmlFor="username"
        hint="Entre 3 y 32 caracteres: letras, números, punto, guion o guion bajo."
        required
        error={errors.username?.message}
      >
        <Input
          id="username"
          autoComplete="username"
          invalid={Boolean(errors.username)}
          aria-describedby={
            errors.username ? "username-error username-hint" : "username-hint"
          }
          {...register("username")}
        />
      </FormField>

      <FormField
        label="Correo electrónico"
        htmlFor="email"
        required
        error={errors.email?.message}
      >
        <Input
          id="email"
          type="email"
          autoComplete="email"
          invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? "email-error" : undefined}
          {...register("email")}
        />
      </FormField>

      <FormField
        label="Contraseña"
        htmlFor="password"
        hint="Mínimo 12 caracteres, con mayúscula, minúscula y número."
        required
        error={errors.password?.message}
      >
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          invalid={Boolean(errors.password)}
          aria-describedby={
            errors.password ? "password-error password-hint" : "password-hint"
          }
          {...register("password")}
        />
      </FormField>

      <FormField
        label="Confirmar contraseña"
        htmlFor="confirmPassword"
        required
        error={errors.confirmPassword?.message}
      >
        <Input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          invalid={Boolean(errors.confirmPassword)}
          aria-describedby={
            errors.confirmPassword ? "confirmPassword-error" : undefined
          }
          {...register("confirmPassword")}
        />
      </FormField>

      <div>
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-1 size-5 accent-[var(--foreground-primary)]"
            aria-describedby={errors.acceptTerms ? "acceptTerms-error" : undefined}
            {...register("acceptTerms")}
          />
          <span>
            Acepto los <Link href="/terminos">términos</Link> y confirmo que leí el{" "}
            <Link href="/privacidad">aviso de privacidad</Link>.
          </span>
        </label>
        {errors.acceptTerms ? (
          <p
            id="acceptTerms-error"
            role="alert"
            className="mb-0 mt-1 text-sm text-[var(--accent-warning)]"
          >
            {errors.acceptTerms.message}
          </p>
        ) : null}
      </div>

      <SubmitStatus error={apiError} />

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "CREANDO CUENTA" : "CREAR CUENTA"}
      </Button>

      <p className="mb-0 text-center text-sm">
        ¿Ya tienes cuenta?{" "}
        <Link
          className="font-semibold underline"
          href={`/login?returnTo=${encodeURIComponent(destination)}`}
        >
          Iniciar sesión
        </Link>
      </p>
    </form>
  );
}

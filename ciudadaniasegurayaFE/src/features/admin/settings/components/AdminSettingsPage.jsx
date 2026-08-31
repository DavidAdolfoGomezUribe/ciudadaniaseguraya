"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { PermissionGate } from "@/components/admin/PermissionGate";
import { FormField } from "@/components/forms/FormField";
import { SubmitStatus } from "@/components/forms/SubmitStatus";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { SystemPanel } from "@/components/ui/SystemPanel";
import { ADMIN_PERMISSIONS } from "@/features/admin/permissions/admin-permissions";
import { adminQueryKeys } from "@/lib/query/admin-query-keys";

import { adminService } from "../../services/admin.service";

const sensitiveKey = /password|hash|token|secret|cookie|credential/i;
const settingCopy = {
  incidentConfirmationThreshold: {
    label: "Confirmaciones para validar un incidente",
    description:
      "Cantidad de confirmaciones comunitarias necesarias antes de validar el registro.",
    min: 2,
    max: 20,
  },
  incidentMatchWindowMinutes: {
    label: "Ventana de coincidencia (minutos)",
    description:
      "Intervalo usado para detectar reportes que podrían pertenecer al mismo incidente.",
    min: 1,
    max: 10_080,
  },
};

function safeSettings(data) {
  if (!Array.isArray(data)) return [];
  return data
    .filter((setting) => setting?.key && !sensitiveKey.test(setting.key))
    .map((setting) => ({
      ...setting,
      ...settingCopy[setting.key],
      label: settingCopy[setting.key]?.label || setting.key,
    }));
}

function SettingEditor({ setting }) {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");
  const mutation = useMutation({
    mutationFn: adminService.settings.update,
    onSuccess: async () => {
      setReason("");
      await queryClient.invalidateQueries({ queryKey: adminQueryKeys.settings });
    },
  });

  return (
    <form
      key={setting.updatedAt || setting.id || setting.key}
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        const values = new FormData(event.currentTarget);
        mutation.mutate({
          key: setting.key,
          value: Number(values.get("value")),
          reason: reason.trim(),
        });
      }}
    >
      <FormField
        label={setting.label}
        htmlFor={`setting-${setting.key}`}
        hint={setting.description}
      >
        <Input
          id={`setting-${setting.key}`}
          name="value"
          type="number"
          min={setting.min}
          max={setting.max}
          defaultValue={String(setting.value)}
          required
        />
      </FormField>
      <FormField
        label="Motivo de la actualización"
        htmlFor={`setting-reason-${setting.key}`}
        required
        hint="Mínimo 10 caracteres; quedará registrado en auditoría."
      >
        <textarea
          id={`setting-reason-${setting.key}`}
          rows={3}
          maxLength={1000}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          className="w-full border border-[var(--border-primary)] bg-[var(--background-elevated)] p-3"
        />
      </FormField>
      <SubmitStatus
        error={mutation.error}
        success={mutation.isSuccess ? "Configuración actualizada y auditada." : null}
      />
      <Button type="submit" disabled={mutation.isPending || reason.trim().length < 10}>
        {mutation.isPending ? "ACTUALIZANDO" : "ACTUALIZAR VALOR"}
      </Button>
    </form>
  );
}

function ReadonlySetting({ setting }) {
  return (
    <div>
      <p className="technical-label mb-2">{setting.label}</p>
      <p className="mb-2 font-mono text-3xl">{setting.value}</p>
      <p className="mb-0 text-sm text-[var(--foreground-secondary)]">
        {setting.description || "Valor de solo lectura para esta sesión."}
      </p>
    </div>
  );
}

export function AdminSettingsPage() {
  const query = useQuery({
    queryKey: adminQueryKeys.settings,
    queryFn: ({ signal }) => adminService.settings.get(signal),
  });
  const settings = safeSettings(query.data);

  return (
    <>
      <AdminPageHeader
        eyebrow="SUPERADMIN · CONFIGURACIÓN CRÍTICA"
        title="Configuración"
        description="Solo se muestran claves editables y no sensibles autorizadas por el backend."
      />
      {query.isLoading ? (
        <p className="technical-label pulse-dot">CARGANDO CONFIGURACIÓN</p>
      ) : query.isError ? (
        <SubmitStatus error={query.error} />
      ) : settings.length ? (
        <div className="grid max-w-5xl gap-5 lg:grid-cols-2">
          {settings.map((setting) => (
            <SystemPanel key={setting.key} className="p-5 sm:p-6">
              <PermissionGate
                any={[ADMIN_PERMISSIONS.SETTINGS_UPDATE]}
                fallback={<ReadonlySetting setting={setting} />}
              >
                <SettingEditor setting={setting} />
              </PermissionGate>
            </SystemPanel>
          ))}
        </div>
      ) : (
        <SystemPanel className="max-w-3xl p-5">
          <p className="mb-0 text-sm text-[var(--foreground-secondary)]">
            El backend no devolvió configuraciones editables.
          </p>
        </SystemPanel>
      )}
    </>
  );
}

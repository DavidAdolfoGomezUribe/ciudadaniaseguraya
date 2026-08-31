"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import { FormField } from "@/components/forms/FormField";
import { SubmitStatus } from "@/components/forms/SubmitStatus";
import { QueryRestoreGate } from "@/components/feedback/QueryRestoreGate";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useCities, useIncidentTypes } from "@/features/map/hooks/useCatalogs";

import { useCreateIncidentReport } from "../hooks/useCreateIncidentReport";
import {
  incidentReportFormSchema,
  toIncidentPayload,
} from "../schemas/incident-report.schema";
import { IncidentLocationPicker } from "./IncidentLocationPicker";
import { ReportConfirmation } from "./ReportConfirmation";

function colombiaNow() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const value = (type) => parts.find((part) => part.type === type)?.value;
  return {
    date: `${value("year")}-${value("month")}-${value("day")}`,
    time: `${value("hour")}:${value("minute")}`,
  };
}

function IncidentReportFields() {
  const initialDate = colombiaNow();
  const cities = useCities();
  const types = useIncidentTypes();
  const createReport = useCreateIncidentReport();
  const [completed, setCompleted] = useState(false);
  const {
    register,
    handleSubmit,
    control,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(incidentReportFormSchema),
    defaultValues: {
      cityId: "",
      incidentType: "",
      title: "",
      description: "",
      date: initialDate.date,
      time: initialDate.time,
      latitude: 4.711,
      longitude: -74.0721,
      locationPrecision: "approximate",
      address: "",
      neighborhood: "",
      sourceUrl: "",
      evidenceDescription: "",
      confirmLocation: false,
    },
  });
  const selectedCityId = useWatch({ control, name: "cityId" });
  const latitude = useWatch({ control, name: "latitude" });
  const longitude = useWatch({ control, name: "longitude" });
  const address = useWatch({ control, name: "address" });

  useEffect(() => {
    if (cities.data?.length && !selectedCityId) {
      setValue("cityId", cities.data[0].id, { shouldValidate: true });
    }
  }, [cities.data, selectedCityId, setValue]);

  if (completed) return <ReportConfirmation />;

  const submit = handleSubmit(async (values) => {
    await createReport.mutateAsync(toIncidentPayload(values));
    reset();
    setCompleted(true);
  });

  return (
    <form className="grid gap-6" onSubmit={submit} noValidate>
      <div className="grid gap-5 md:grid-cols-2">
        <FormField
          label="Ciudad"
          htmlFor="cityId"
          required
          error={errors.cityId?.message}
        >
          <Select
            id="cityId"
            invalid={Boolean(errors.cityId)}
            disabled={cities.isPending}
            {...register("cityId")}
          >
            <option value="">Selecciona una ciudad</option>
            {cities.data?.map((city) => (
              <option key={city.id} value={city.id}>
                {city.name}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField
          label="Tipo de incidente"
          htmlFor="incidentType"
          required
          error={errors.incidentType?.message}
        >
          <Select
            id="incidentType"
            invalid={Boolean(errors.incidentType)}
            disabled={types.isPending}
            {...register("incidentType")}
          >
            <option value="">Selecciona una categoría</option>
            {types.data?.map((type) => (
              <option key={type.code} value={type.code}>
                {type.name}
              </option>
            ))}
          </Select>
        </FormField>
      </div>

      <FormField label="Título" htmlFor="title" required error={errors.title?.message}>
        <Input
          id="title"
          maxLength={120}
          invalid={Boolean(errors.title)}
          {...register("title")}
        />
      </FormField>

      <FormField
        label="Descripción"
        htmlFor="description"
        required
        error={errors.description?.message}
      >
        <textarea
          id="description"
          rows={6}
          maxLength={2000}
          className="w-full resize-y border border-[var(--border-primary)] bg-[var(--background-elevated)] p-3"
          aria-invalid={Boolean(errors.description)}
          {...register("description")}
        />
      </FormField>

      <div className="grid gap-5 md:grid-cols-2">
        <FormField label="Fecha" htmlFor="date" required error={errors.date?.message}>
          <Input
            id="date"
            type="date"
            invalid={Boolean(errors.date)}
            {...register("date")}
          />
        </FormField>
        <FormField label="Hora" htmlFor="time" required error={errors.time?.message}>
          <Input
            id="time"
            type="time"
            invalid={Boolean(errors.time)}
            {...register("time")}
          />
        </FormField>
      </div>

      <IncidentLocationPicker
        latitude={latitude}
        longitude={longitude}
        address={address}
        errors={errors}
        onChange={(values) => {
          if (values.latitude !== undefined) {
            setValue("latitude", values.latitude, {
              shouldDirty: true,
              shouldValidate: true,
            });
          }
          if (values.longitude !== undefined) {
            setValue("longitude", values.longitude, {
              shouldDirty: true,
              shouldValidate: true,
            });
          }
          if (values.address !== undefined) {
            setValue("address", values.address, { shouldDirty: true });
          }
        }}
      />

      <div className="grid gap-5 md:grid-cols-2">
        <FormField
          label="Precisión de la ubicación"
          htmlFor="locationPrecision"
          required
        >
          <Select id="locationPrecision" {...register("locationPrecision")}>
            <option value="exact">Punto exacto</option>
            <option value="approximate">Ubicación aproximada</option>
            <option value="hexagon">Solo área H3</option>
          </Select>
        </FormField>
        <FormField
          label="Barrio"
          htmlFor="neighborhood"
          error={errors.neighborhood?.message}
        >
          <Input id="neighborhood" maxLength={100} {...register("neighborhood")} />
        </FormField>
      </div>

      <FormField
        label="Enlace de noticia o fuente"
        htmlFor="sourceUrl"
        hint="Opcional. Solo se admiten direcciones HTTP o HTTPS."
        error={errors.sourceUrl?.message}
      >
        <Input
          id="sourceUrl"
          type="url"
          placeholder="https://"
          invalid={Boolean(errors.sourceUrl)}
          {...register("sourceUrl")}
        />
      </FormField>

      <FormField
        label="Descripción de evidencia"
        htmlFor="evidenceDescription"
        hint="Describe la fuente sin incluir datos personales."
        error={errors.evidenceDescription?.message}
      >
        <textarea
          id="evidenceDescription"
          rows={3}
          maxLength={500}
          className="w-full resize-y border border-[var(--border-primary)] bg-[var(--background-elevated)] p-3"
          {...register("evidenceDescription")}
        />
      </FormField>

      <div>
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-1 size-5 accent-[var(--foreground-primary)]"
            {...register("confirmLocation")}
          />
          <span>
            Confirmo que la ubicación seleccionada corresponde al incidente y comprendo
            que el backend volverá a validarla.
          </span>
        </label>
        {errors.confirmLocation ? (
          <p role="alert" className="text-sm text-[var(--accent-warning)]">
            {errors.confirmLocation.message}
          </p>
        ) : null}
      </div>

      <SubmitStatus error={createReport.error} />
      <div className="border-l-4 border-[var(--accent-information)] bg-[var(--surface-information)] p-3 text-sm">
        El envío quedará pendiente. La plataforma no lo presentará como información
        validada hasta completar el proceso correspondiente.
      </div>
      <Button type="submit" disabled={isSubmitting || createReport.isPending}>
        {isSubmitting || createReport.isPending ? "ENVIANDO REPORTE" : "ENVIAR REPORTE"}
      </Button>
    </form>
  );
}

export function IncidentReportForm() {
  return (
    <QueryRestoreGate
      fallback={
        <div className="system-panel grid min-h-72 place-items-center" role="status">
          <p className="technical-label pulse-dot">PREPARANDO FORMULARIO</p>
        </div>
      }
    >
      <IncidentReportFields />
    </QueryRestoreGate>
  );
}

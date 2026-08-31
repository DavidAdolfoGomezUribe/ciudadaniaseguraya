"use client";

import { useEffect, useId, useRef, useState } from "react";

import { FormField } from "@/components/forms/FormField";
import { Button } from "@/components/ui/Button";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

export function ConfirmationDialog({ open, ...props }) {
  if (!open) return null;
  return <ConfirmationDialogContent {...props} />;
}

function ConfirmationDialogContent({
  title,
  action,
  resource,
  consequence,
  confirmLabel = "CONFIRMAR",
  confirmVariant = "danger",
  requireReason = true,
  confirmationText,
  reasonCodes,
  onClose,
  onConfirm,
}) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef(null);
  const previousFocus = useRef(null);
  const onCloseRef = useRef(onClose);
  const [reason, setReason] = useState("");
  const [reasonCode, setReasonCode] = useState(reasonCodes?.[0]?.value || "");
  const [typedConfirmation, setTypedConfirmation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    previousFocus.current = document.activeElement;
    const dialog = dialogRef.current;
    const focusable = dialog?.querySelector(
      "textarea, input, select, button:not([disabled])",
    );
    focusable?.focus();

    const keydown = (event) => {
      if (event.key === "Escape") onCloseRef.current?.();
      if (event.key !== "Tab" || !dialog) return;
      const elements = [
        ...dialog.querySelectorAll(
          "button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled])",
        ),
      ];
      if (!elements.length) return;
      const first = elements[0];
      const last = elements.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", keydown);
    return () => {
      document.removeEventListener("keydown", keydown);
      previousFocus.current?.focus?.();
    };
  }, []);
  const disabled =
    submitting ||
    (requireReason && reason.trim().length < 10) ||
    (confirmationText && typedConfirmation !== confirmationText);

  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-black/55 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !submitting) onClose?.();
      }}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="system-panel my-auto w-full max-w-xl p-6 sm:p-8"
      >
        <p className="technical-label mb-2">CONFIRMACIÓN · ACCIÓN CRÍTICA</p>
        <h2 id={titleId} className="mb-3 text-2xl font-semibold">
          {title}
        </h2>
        <div id={descriptionId} className="mb-5 text-sm leading-6">
          <p>
            <strong>Acción:</strong> {action}
          </p>
          <p>
            <strong>Recurso:</strong> {resource}
          </p>
          <p className="mb-0 text-[var(--foreground-secondary)]">{consequence}</p>
        </div>

        <div className="grid gap-4">
          {reasonCodes?.length ? (
            <FormField label="Código de motivo" htmlFor="confirmation-reason-code">
              <Select
                id="confirmation-reason-code"
                value={reasonCode}
                onChange={(event) => setReasonCode(event.target.value)}
              >
                {reasonCodes.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </FormField>
          ) : null}

          {requireReason ? (
            <FormField
              label="Motivo"
              htmlFor="confirmation-reason"
              required
              hint="Mínimo 10 caracteres. El motivo quedará en auditoría."
            >
              <textarea
                id="confirmation-reason"
                rows={4}
                maxLength={1000}
                value={reason}
                className="w-full resize-y border border-[var(--border-primary)] bg-[var(--background-elevated)] p-3 text-[var(--foreground-primary)]"
                onChange={(event) => setReason(event.target.value)}
              />
            </FormField>
          ) : null}

          {confirmationText ? (
            <FormField
              label={`Escribe ${confirmationText} para confirmar`}
              htmlFor="confirmation-text"
              required
            >
              <Input
                id="confirmation-text"
                autoComplete="off"
                value={typedConfirmation}
                onChange={(event) => setTypedConfirmation(event.target.value)}
              />
            </FormField>
          ) : null}
          <ErrorMessage requestId={error?.requestId}>{error?.message}</ErrorMessage>
        </div>

        <div className="mt-6 flex flex-col-reverse justify-end gap-2 sm:flex-row">
          <Button variant="secondary" disabled={submitting} onClick={onClose}>
            CANCELAR
          </Button>
          <Button
            variant={confirmVariant}
            disabled={disabled}
            onClick={async () => {
              setSubmitting(true);
              setError(null);
              try {
                await onConfirm?.({
                  reason: reason.trim(),
                  ...(reasonCode ? { reasonCode } : {}),
                  ...(confirmationText ? { confirmation: typedConfirmation } : {}),
                });
                onClose?.();
              } catch (caught) {
                setError(caught);
                setSubmitting(false);
              }
            }}
          >
            {submitting ? "PROCESANDO" : confirmLabel}
          </Button>
        </div>
      </section>
    </div>
  );
}

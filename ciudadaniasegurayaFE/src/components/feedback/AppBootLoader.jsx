"use client";

import { useEffect, useMemo, useState } from "react";

import { useAuth } from "@/features/auth/components/AuthProvider";
import { Button } from "@/components/ui/Button";

const messages = [
  "INICIALIZANDO SISTEMA CARTOGRÁFICO",
  "CARGANDO LÍMITES TERRITORIALES",
  "SINCRONIZANDO DATOS H3",
  "PREPARANDO ESTADÍSTICAS",
  "ESTABLECIENDO CANAL EN TIEMPO REAL",
  "SISTEMA DISPONIBLE",
];

export function AppBootLoader({ mapReady, statisticsReady }) {
  const { status: authStatus } = useAuth();
  const [minimumElapsed, setMinimumElapsed] = useState(false);
  const [recovery, setRecovery] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const complete =
    mapReady && statisticsReady && authStatus !== "loading" && minimumElapsed;

  useEffect(() => {
    const minimumTimer = setTimeout(() => setMinimumElapsed(true), 600);
    const recoveryTimer = setTimeout(() => setRecovery(true), 10_000);
    return () => {
      clearTimeout(minimumTimer);
      clearTimeout(recoveryTimer);
    };
  }, []);

  useEffect(() => {
    if (!complete) return;
    const timer = setTimeout(() => {
      setDismissed(true);
      document.getElementById("landing-title")?.focus({ preventScroll: true });
    }, 180);
    return () => clearTimeout(timer);
  }, [complete]);

  const progress = useMemo(() => {
    return (
      Number(authStatus !== "loading") * 20 +
      Number(mapReady) * 45 +
      Number(statisticsReady) * 35
    );
  }, [authStatus, mapReady, statisticsReady]);

  if (dismissed) return null;

  return (
    <div
      className="fixed inset-0 z-[999] grid place-items-center bg-[var(--background-primary)] p-5"
      role="status"
      aria-live="polite"
      aria-label="Inicializando Ciudadanía Segura Ya"
    >
      <div className="w-full max-w-2xl">
        <div className="mb-7 flex items-end justify-between border-b border-[var(--border-primary)] pb-3">
          <div>
            <p className="technical-label mb-1">CSY · BOOT SEQUENCE</p>
            <h2 className="mb-0 text-2xl font-semibold">Inicialización</h2>
          </div>
          <span className="font-mono text-3xl tabular-nums">{progress}%</span>
        </div>

        <div className="relative mb-6 h-2 overflow-hidden border border-[var(--border-primary)]">
          <div
            className="h-full bg-[var(--foreground-primary)] transition-[width] duration-300"
            style={{ width: `${progress}%` }}
          />
          {!complete ? (
            <div className="scan-line absolute inset-y-0 w-1/4 bg-[var(--loader-scan)]" />
          ) : null}
        </div>

        <ol className="m-0 grid gap-2 p-0">
          {messages.map((message, index) => {
            const threshold = [5, 20, 45, 75, 90, 100][index];
            const done = progress >= threshold;
            return (
              <li
                key={message}
                className="flex items-center justify-between gap-3 border-b border-[var(--border-soft)] py-2 font-mono text-xs"
              >
                <span>{message}</span>
                <span aria-label={done ? "completo" : "pendiente"}>
                  {done ? "●" : "○"}
                </span>
              </li>
            );
          })}
        </ol>

        {recovery && !complete ? (
          <div className="mt-6 border-l-4 border-[var(--accent-warning)] bg-[var(--surface-warning)] p-4">
            <p className="technical-label mb-2">MODO DE RECUPERACIÓN</p>
            <p className="text-sm">
              Algunos servicios tardan más de lo esperado. Puedes reintentar o continuar
              con la interfaz disponible y los datos guardados.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => window.location.reload()}>REINTENTAR</Button>
              <Button variant="secondary" onClick={() => setDismissed(true)}>
                CONTINUAR SIN MAPA COMPLETO
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

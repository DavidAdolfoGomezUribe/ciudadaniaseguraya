import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { SystemPanel } from "@/components/ui/SystemPanel";

function variationLabel(comparison) {
  if (!comparison) return "Sin comparación disponible";
  if (comparison.percentageChange == null) {
    return `${comparison.absoluteChange > 0 ? "+" : ""}${comparison.absoluteChange} registros; sin base porcentual`;
  }
  return `${comparison.percentageChange > 0 ? "+" : ""}${comparison.percentageChange}% frente al periodo anterior`;
}

export function StatisticsOverview({ query }) {
  const data = query.data;

  return (
    <SystemPanel className="p-5 md:col-span-2">
      <p className="technical-label mb-2">RESUMEN DEL ALCANCE</p>
      {query.isPending ? (
        <p role="status" className="technical-label pulse-dot">
          CONSULTANDO RESUMEN
        </p>
      ) : query.error ? (
        <ErrorMessage requestId={query.error.requestId}>
          {query.error.message}
        </ErrorMessage>
      ) : (
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <dt className="technical-label">TOTAL VALIDADO</dt>
            <dd className="m-0 mt-1 font-mono text-2xl">{data?.totalIncidents ?? 0}</dd>
          </div>
          <div>
            <dt className="technical-label">VARIACIÓN</dt>
            <dd className="m-0 mt-1 text-sm">{variationLabel(data?.comparison)}</dd>
          </div>
          <div>
            <dt className="technical-label">COMUNITARIA</dt>
            <dd className="m-0 mt-1 font-mono text-2xl">
              {data?.validation?.communityConfirmed ?? 0}
            </dd>
          </div>
          <div>
            <dt className="technical-label">ADMINISTRATIVA</dt>
            <dd className="m-0 mt-1 font-mono text-2xl">
              {data?.validation?.adminVerified ?? 0}
            </dd>
          </div>
          <div>
            <dt className="technical-label">ACTUALIZADO</dt>
            <dd className="m-0 mt-1 text-sm">
              {data?.lastUpdatedAt
                ? new Date(data.lastUpdatedAt).toLocaleString("es-CO")
                : "No disponible"}
            </dd>
          </div>
        </dl>
      )}
    </SystemPanel>
  );
}

"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { SystemPanel } from "@/components/ui/SystemPanel";

import { ChartDataSummary } from "./ChartDataSummary";
import { ChartDataTable } from "./ChartDataTable";

export function ChartPanel({
  title,
  description,
  series,
  status,
  error,
  type = "bar",
  horizontal = false,
}) {
  const Chart = type === "line" ? LineChart : BarChart;

  return (
    <SystemPanel className="chart-panel">
      <p className="technical-label mb-2">{title}</p>
      <p className="min-h-10 text-sm text-[var(--foreground-secondary)]">
        {description}
      </p>

      {status === "pending" ? (
        <div className="chart-canvas grid place-items-center" role="status">
          <span className="technical-label pulse-dot">CONSULTANDO AGREGADOS</span>
        </div>
      ) : error ? (
        <div className="chart-canvas grid place-items-center">
          <ErrorMessage requestId={error.requestId}>{error.message}</ErrorMessage>
        </div>
      ) : !series.length ? (
        <div className="chart-canvas grid place-items-center text-center">
          <p className="max-w-xs text-sm text-[var(--foreground-secondary)]">
            No hay información agregada disponible para este periodo.
          </p>
        </div>
      ) : (
        <>
          <ChartDataSummary series={series} />
          <div
            className="chart-canvas"
            role="img"
            aria-label={`${title}. ${description}`}
          >
            <ResponsiveContainer width="100%" height={270}>
              <Chart
                data={series}
                layout={horizontal ? "vertical" : "horizontal"}
                margin={{ top: 8, right: 12, bottom: 12, left: 4 }}
              >
                <CartesianGrid stroke="var(--chart-grid)" strokeOpacity={0.25} />
                {horizontal ? (
                  <>
                    <XAxis
                      type="number"
                      allowDecimals={false}
                      tick={{ fill: "var(--foreground-secondary)", fontSize: 11 }}
                      axisLine={{ stroke: "var(--border-primary)" }}
                      tickLine={{ stroke: "var(--border-primary)" }}
                    />
                    <YAxis
                      type="category"
                      dataKey="label"
                      width={96}
                      tick={{ fill: "var(--foreground-secondary)", fontSize: 11 }}
                      axisLine={{ stroke: "var(--border-primary)" }}
                      tickLine={{ stroke: "var(--border-primary)" }}
                    />
                  </>
                ) : (
                  <>
                    <XAxis
                      dataKey="label"
                      minTickGap={20}
                      tick={{ fill: "var(--foreground-secondary)", fontSize: 11 }}
                      axisLine={{ stroke: "var(--border-primary)" }}
                      tickLine={{ stroke: "var(--border-primary)" }}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fill: "var(--foreground-secondary)", fontSize: 11 }}
                      axisLine={{ stroke: "var(--border-primary)" }}
                      tickLine={{ stroke: "var(--border-primary)" }}
                    />
                  </>
                )}
                <Tooltip
                  cursor={{ fill: "var(--chart-cursor)" }}
                  formatter={(value) => [value, "Registros"]}
                  contentStyle={{
                    color: "var(--foreground-primary)",
                    background: "var(--background-elevated)",
                    border: "1px solid var(--border-primary)",
                    borderRadius: 0,
                  }}
                  labelStyle={{ color: "var(--foreground-primary)" }}
                  itemStyle={{ color: "var(--foreground-primary)" }}
                />
                {type === "line" ? (
                  <Line
                    type="monotone"
                    dataKey="incidentCount"
                    name="Registros"
                    stroke="var(--chart-line)"
                    strokeWidth={2}
                    dot={{ fill: "var(--chart-dot)", r: 2 }}
                    activeDot={{ r: 5 }}
                    isAnimationActive={false}
                  />
                ) : (
                  <Bar
                    dataKey="incidentCount"
                    name="Registros"
                    fill="var(--chart-bar)"
                    isAnimationActive={false}
                  />
                )}
              </Chart>
            </ResponsiveContainer>
          </div>
          <ChartDataTable title={title} series={series} />
        </>
      )}
    </SystemPanel>
  );
}

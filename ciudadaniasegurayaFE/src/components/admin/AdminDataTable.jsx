"use client";

import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { classNames } from "@/lib/utils/class-names";

function cellValue(column, row) {
  if (column.render) return column.render(row);
  if (typeof column.accessor === "function") return column.accessor(row);
  return row?.[column.key] ?? "—";
}

function LoadingRows({ columns }) {
  return Array.from({ length: 6 }, (_, row) => (
    <tr key={row}>
      {columns.map((column) => (
        <td key={column.key} className="border-b border-[var(--border-soft)] p-3">
          <span className="block h-4 animate-pulse bg-[var(--background-panel)]" />
        </td>
      ))}
    </tr>
  ));
}

export function AdminDataTable({
  caption,
  columns,
  rows = [],
  rowKey = (row) => row.id || row._id,
  loading = false,
  error,
  onRetry,
  pagination,
  onPageChange,
  sort,
  onSort,
  selectedIds,
  onSelect,
}) {
  const selectable = Boolean(selectedIds && onSelect);
  const allSelected =
    selectable && rows.length > 0 && rows.every((row) => selectedIds.has(rowKey(row)));

  if (error && !loading) {
    return (
      <div className="system-panel p-6">
        <ErrorMessage requestId={error.requestId}>{error.message}</ErrorMessage>
        {onRetry ? (
          <Button className="mt-4" variant="secondary" onClick={onRetry}>
            REINTENTAR
          </Button>
        ) : null}
      </div>
    );
  }

  if (!loading && rows.length === 0) {
    return (
      <EmptyState title="SIN RESULTADOS">
        No hay registros que coincidan con los filtros actuales.
      </EmptyState>
    );
  }

  const visibleColumns = selectable
    ? [
        {
          key: "__selection",
          header: (
            <input
              type="checkbox"
              aria-label="Seleccionar todos los registros visibles"
              checked={allSelected}
              onChange={(event) => {
                for (const row of rows) onSelect(rowKey(row), event.target.checked);
              }}
            />
          ),
          render: (row) => (
            <input
              type="checkbox"
              aria-label={`Seleccionar ${rowKey(row)}`}
              checked={selectedIds.has(rowKey(row))}
              onChange={(event) => onSelect(rowKey(row), event.target.checked)}
            />
          ),
        },
        ...columns,
      ]
    : columns;

  return (
    <section className="system-panel overflow-hidden">
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[760px] border-collapse text-left text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead className="bg-[var(--background-secondary)]">
            <tr>
              {visibleColumns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={classNames(
                    "border-b border-[var(--border-primary)] p-3 font-mono text-[0.65rem] uppercase tracking-[0.09em]",
                    column.className,
                  )}
                >
                  {column.sortable ? (
                    <button
                      type="button"
                      className="inline-flex min-h-8 items-center gap-1 text-left"
                      onClick={() =>
                        onSort?.({
                          sortBy: column.key,
                          sortOrder:
                            sort?.sortBy === column.key && sort.sortOrder === "asc"
                              ? "desc"
                              : "asc",
                        })
                      }
                    >
                      {column.header}
                      {sort?.sortBy === column.key ? (
                        sort.sortOrder === "asc" ? (
                          <ArrowUp size={13} aria-label="Ascendente" />
                        ) : (
                          <ArrowDown size={13} aria-label="Descendente" />
                        )
                      ) : null}
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <LoadingRows columns={visibleColumns} />
            ) : (
              rows.map((row) => (
                <tr
                  key={rowKey(row)}
                  className="align-top hover:bg-[var(--background-secondary)]"
                >
                  {visibleColumns.map((column) => (
                    <td
                      key={column.key}
                      className={classNames(
                        "border-b border-[var(--border-soft)] p-3",
                        column.className,
                      )}
                    >
                      {cellValue(column, row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 p-3 md:hidden">
        {loading
          ? Array.from({ length: 4 }, (_, index) => (
              <div
                key={index}
                className="h-40 animate-pulse border border-[var(--border-soft)] bg-[var(--background-panel)]"
              />
            ))
          : rows.map((row) => (
              <article
                key={rowKey(row)}
                className="border border-[var(--border-primary)] bg-[var(--background-elevated)] p-4"
              >
                {columns.map((column) => (
                  <div
                    key={column.key}
                    className="grid grid-cols-[minmax(6rem,0.7fr)_minmax(0,1.3fr)] gap-3 border-b border-[var(--border-soft)] py-2 last:border-0"
                  >
                    <span className="font-mono text-[0.62rem] font-bold uppercase tracking-[0.08em]">
                      {column.header}
                    </span>
                    <span className="min-w-0 break-words text-sm">
                      {cellValue(column, row)}
                    </span>
                  </div>
                ))}
              </article>
            ))}
      </div>

      {pagination ? (
        <div className="flex flex-col items-center justify-between gap-3 border-t border-[var(--border-primary)] bg-[var(--background-secondary)] p-3 sm:flex-row">
          <p className="mb-0 font-mono text-xs">
            PÁGINA {pagination.page} DE {pagination.totalPages} · {pagination.total}{" "}
            REGISTROS
          </p>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              disabled={pagination.page <= 1}
              aria-label="Página anterior"
              onClick={() => onPageChange?.(pagination.page - 1)}
            >
              <ChevronLeft size={15} aria-hidden="true" /> ANTERIOR
            </Button>
            <Button
              variant="secondary"
              disabled={pagination.page >= pagination.totalPages}
              aria-label="Página siguiente"
              onClick={() => onPageChange?.(pagination.page + 1)}
            >
              SIGUIENTE <ChevronRight size={15} aria-hidden="true" />
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export function AdminFilters({ children }) {
  return (
    <section
      aria-label="Filtros de la tabla"
      className="system-panel mb-5 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4"
    >
      {children}
    </section>
  );
}

import { ErrorMessage } from "@/components/ui/ErrorMessage";

export function SubmitStatus({ error, success }) {
  return (
    <div aria-live="polite">
      {error ? (
        <ErrorMessage requestId={error.requestId}>{error.message}</ErrorMessage>
      ) : null}
      {success ? (
        <div className="border-l-4 border-[var(--accent-success)] bg-[var(--surface-success)] px-3 py-2 text-sm">
          {success}
        </div>
      ) : null}
    </div>
  );
}

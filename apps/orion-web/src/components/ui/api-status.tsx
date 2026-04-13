export function ApiStatusBanner({
  error,
  hint,
}: {
  error: string;
  hint?: string;
}) {
  return (
    <div
      className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100"
      role="alert"
    >
      <p className="font-medium">Geen verbinding met de API</p>
      <p className="mt-1 opacity-90">{error}</p>
      {hint ? <p className="mt-2 text-xs opacity-80">{hint}</p> : null}
    </div>
  );
}

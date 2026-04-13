import Link from "next/link";

const actions = [
  { label: "New client", href: "/clients/new" },
  { label: "New project", href: "/projects/new" },
  { label: "New task", href: "/tasks/new" },
  { label: "New invoice", href: "/invoices/new" },
] as const;

export function QuickActions() {
  return (
    <div className="rounded-xl border border-border bg-surface p-5 shadow-card">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
        Quick actions
      </h2>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {actions.map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className="rounded-lg border border-border bg-surface-muted/60 px-3 py-3 text-center text-sm font-medium text-slate-800 transition-colors hover:border-accent/40 hover:bg-accent/5 dark:text-slate-200"
          >
            {a.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

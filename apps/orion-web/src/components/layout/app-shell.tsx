import type { ReactNode } from "react";
import Link from "next/link";
import { SignOutButton } from "@/components/layout/sign-out-button";

const nav = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Clients", href: "/clients" },
  { label: "Projects", href: "/projects" },
  { label: "Tasks", href: "/tasks" },
  { label: "Meetings", href: "/meetings" },
  { label: "Invoices", href: "/invoices" },
] as const;

const linkClass =
  "rounded-md px-3 py-2 text-sm text-slate-600 transition-colors hover:bg-surface-muted hover:text-slate-900 dark:text-slate-400 dark:hover:bg-surface-muted dark:hover:text-white";

export function AppShell({
  children,
  tenantName,
  userEmail,
  userRole,
}: {
  children: ReactNode;
  /** Workspace-naam uit API; fallback in layout */
  tenantName?: string;
  userEmail?: string;
  userRole?: string;
}) {
  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="hidden w-56 shrink-0 border-r border-border bg-surface md:block">
        <div className="flex h-14 items-center border-b border-border px-4">
          <Link
            href="/dashboard"
            className="text-sm font-semibold tracking-tight text-slate-900 dark:text-white"
          >
            Orion
          </Link>
        </div>
        <nav className="flex flex-col gap-0.5 p-3" aria-label="Hoofdmenu">
          {nav.map((item) => (
            <Link key={item.href} href={item.href} className={linkClass}>
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border bg-surface px-4 md:px-8">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{tenantName ?? "…"}</p>
            {userEmail ? (
              <p className="truncate text-xs text-slate-500">
                {userEmail}
                {userRole ? ` · ${userRole}` : ""}
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <SignOutButton />
            <div
              className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600"
              aria-hidden
            />
          </div>
        </header>

        {/* Mobile / smalle vensters: sidebar was verborgen — horizontaal menu */}
        <nav
          className="flex shrink-0 gap-1 overflow-x-auto border-b border-border bg-surface px-2 py-2 md:hidden"
          aria-label="Hoofdmenu"
        >
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="shrink-0 whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs font-medium text-slate-600 ring-1 ring-slate-200/80 hover:bg-surface-muted hover:text-slate-900 dark:text-slate-400 dark:ring-slate-700 dark:hover:bg-surface-muted dark:hover:text-white"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}

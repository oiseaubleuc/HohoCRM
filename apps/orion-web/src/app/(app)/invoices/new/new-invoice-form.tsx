"use client";

import { useActionState } from "react";
import { createInvoice, type InvoiceFormState } from "./actions";

const initial: InvoiceFormState = { error: null };

const inputClass =
  "mt-1 w-full rounded-lg border border-border bg-surface-muted/50 px-3 py-2 text-sm outline-none ring-accent focus:ring-2";

type ProjectOpt = { id: string; title: string };
type ClientOpt = { id: string; companyName: string };

export function NewInvoiceForm({
  clients,
  projects,
  defaultIssueDate,
  defaultDueDate,
}: {
  clients: ClientOpt[];
  projects: ProjectOpt[];
  defaultIssueDate?: string;
  defaultDueDate?: string;
}) {
  const [state, formAction, pending] = useActionState(createInvoice, initial);

  return (
    <form action={formAction} className="mt-6 space-y-4">
      <div>
        <label htmlFor="clientId" className="block text-xs font-medium text-slate-600 dark:text-slate-400">
          Klant *
        </label>
        <select id="clientId" name="clientId" required className={inputClass}>
          <option value="">— Kies —</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.companyName}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="projectId" className="block text-xs font-medium text-slate-600 dark:text-slate-400">
          Project (optioneel)
        </label>
        <select id="projectId" name="projectId" className={inputClass}>
          <option value="">—</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="amount" className="block text-xs font-medium text-slate-600 dark:text-slate-400">
          Bedrag (EUR) *
        </label>
        <input id="amount" name="amount" type="text" inputMode="decimal" placeholder="1250,00" className={inputClass} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="issueDate" className="block text-xs font-medium text-slate-600 dark:text-slate-400">
            Uitgiftedatum *
          </label>
          <input
            id="issueDate"
            name="issueDate"
            type="date"
            required
            className={inputClass}
            defaultValue={defaultIssueDate}
          />
        </div>
        <div>
          <label htmlFor="dueDate" className="block text-xs font-medium text-slate-600 dark:text-slate-400">
            Vervaldatum *
          </label>
          <input
            id="dueDate"
            name="dueDate"
            type="date"
            required
            className={inputClass}
            defaultValue={defaultDueDate}
          />
        </div>
      </div>
      {state.error ? (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {state.error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "Bezig…" : "Factuur aanmaken (concept)"}
      </button>
    </form>
  );
}

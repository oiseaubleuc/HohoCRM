"use client";

import { useActionState } from "react";
import { createProject, type ProjectFormState } from "./actions";

const initial: ProjectFormState = { error: null };

const inputClass =
  "mt-1 w-full rounded-lg border border-border bg-surface-muted/50 px-3 py-2 text-sm outline-none ring-accent focus:ring-2";

type ClientOpt = { id: string; companyName: string };

export function NewProjectForm({ clients }: { clients: ClientOpt[] }) {
  const [state, formAction, pending] = useActionState(createProject, initial);

  return (
    <form action={formAction} className="mt-6 space-y-4">
      <div>
        <label htmlFor="title" className="block text-xs font-medium text-slate-600 dark:text-slate-400">
          Titel *
        </label>
        <input id="title" name="title" required className={inputClass} />
      </div>
      <div>
        <label htmlFor="clientId" className="block text-xs font-medium text-slate-600 dark:text-slate-400">
          Klant (optioneel)
        </label>
        <select id="clientId" name="clientId" className={inputClass}>
          <option value="">—</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.companyName}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="status" className="block text-xs font-medium text-slate-600 dark:text-slate-400">
          Status
        </label>
        <select id="status" name="status" className={inputClass}>
          <option value="PLANNED">Gepland</option>
          <option value="ACTIVE">Actief</option>
          <option value="BLOCKED">Geblokkeerd</option>
          <option value="COMPLETED">Afgerond</option>
        </select>
      </div>
      <div>
        <label htmlFor="priority" className="block text-xs font-medium text-slate-600 dark:text-slate-400">
          Prioriteit
        </label>
        <select id="priority" name="priority" className={inputClass}>
          <option value="LOW">Laag</option>
          <option value="NORMAL">Normaal</option>
          <option value="HIGH">Hoog</option>
          <option value="URGENT">Urgent</option>
        </select>
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
        {pending ? "Bezig…" : "Project aanmaken"}
      </button>
    </form>
  );
}

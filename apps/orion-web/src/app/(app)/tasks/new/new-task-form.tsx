"use client";

import { useActionState } from "react";
import { createTask, type TaskFormState } from "./actions";

const initial: TaskFormState = { error: null };

const inputClass =
  "mt-1 w-full rounded-lg border border-border bg-surface-muted/50 px-3 py-2 text-sm outline-none ring-accent focus:ring-2";

type ProjectOpt = { id: string; title: string };
type ClientOpt = { id: string; companyName: string };

export function NewTaskForm({ projects, clients }: { projects: ProjectOpt[]; clients: ClientOpt[] }) {
  const [state, formAction, pending] = useActionState(createTask, initial);

  return (
    <form action={formAction} className="mt-6 space-y-4">
      <div>
        <label htmlFor="title" className="block text-xs font-medium text-slate-600 dark:text-slate-400">
          Titel *
        </label>
        <input id="title" name="title" required className={inputClass} />
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
        <label htmlFor="dueDate" className="block text-xs font-medium text-slate-600 dark:text-slate-400">
          Deadline
        </label>
        <input id="dueDate" name="dueDate" type="date" className={inputClass} />
      </div>
      <div>
        <label htmlFor="status" className="block text-xs font-medium text-slate-600 dark:text-slate-400">
          Status
        </label>
        <select id="status" name="status" className={inputClass}>
          <option value="TODO">Te doen</option>
          <option value="IN_PROGRESS">Bezig</option>
          <option value="BLOCKED">Geblokkeerd</option>
          <option value="DONE">Klaar</option>
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
        {pending ? "Bezig…" : "Taak aanmaken"}
      </button>
    </form>
  );
}

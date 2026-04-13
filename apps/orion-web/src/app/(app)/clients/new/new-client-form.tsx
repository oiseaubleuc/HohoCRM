"use client";

import { useActionState } from "react";
import { createClient, type ClientFormState } from "./actions";

const initial: ClientFormState = { error: null };

const inputClass =
  "mt-1 w-full rounded-lg border border-border bg-surface-muted/50 px-3 py-2 text-sm outline-none ring-accent focus:ring-2";

export function NewClientForm() {
  const [state, formAction, pending] = useActionState(createClient, initial);

  return (
    <form action={formAction} className="mt-6 space-y-4">
      <div>
        <label htmlFor="companyName" className="block text-xs font-medium text-slate-600 dark:text-slate-400">
          Bedrijfsnaam *
        </label>
        <input id="companyName" name="companyName" required className={inputClass} />
      </div>
      <div>
        <label htmlFor="contactName" className="block text-xs font-medium text-slate-600 dark:text-slate-400">
          Contactpersoon
        </label>
        <input id="contactName" name="contactName" className={inputClass} />
      </div>
      <div>
        <label htmlFor="email" className="block text-xs font-medium text-slate-600 dark:text-slate-400">
          E-mail
        </label>
        <input id="email" name="email" type="email" className={inputClass} />
      </div>
      <div>
        <label htmlFor="city" className="block text-xs font-medium text-slate-600 dark:text-slate-400">
          Stad
        </label>
        <input id="city" name="city" className={inputClass} />
      </div>
      <div>
        <label htmlFor="status" className="block text-xs font-medium text-slate-600 dark:text-slate-400">
          Status
        </label>
        <select id="status" name="status" className={inputClass}>
          <option value="LEAD">Lead</option>
          <option value="PROSPECT">Prospect</option>
          <option value="ACTIVE">Actief</option>
          <option value="INACTIVE">Inactief</option>
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
        {pending ? "Bezig…" : "Klant aanmaken"}
      </button>
    </form>
  );
}

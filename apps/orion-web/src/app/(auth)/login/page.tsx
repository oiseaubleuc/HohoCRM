"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";

function LoginForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";
  const [email, setEmail] = useState("owner@demo.orion.app");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
      callbackUrl,
    });
    setPending(false);
    if (res?.error) {
      setError("Ongeldig e-mailadres of wachtwoord.");
      return;
    }
    if (res?.url) {
      window.location.href = res.url;
    }
  }

  return (
    <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-8 shadow-card">
      <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">Orion</h1>
      <p className="mt-1 text-sm text-slate-500">Log in op je workspace</p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <div>
          <label htmlFor="email" className="block text-xs font-medium text-slate-600 dark:text-slate-400">
            E-mail
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-surface-muted/50 px-3 py-2 text-sm outline-none ring-accent focus:ring-2"
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-xs font-medium text-slate-600 dark:text-slate-400">
            Wachtwoord
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-surface-muted/50 px-3 py-2 text-sm outline-none ring-accent focus:ring-2"
          />
        </div>
        {error ? (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-accent py-2.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? "Bezig…" : "Inloggen"}
        </button>
      </form>

      <p className="mt-6 text-xs text-slate-500">
        Demo (na <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">npm run db:seed</code> in{" "}
        <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">backend/</code>): wachtwoord{" "}
        <strong>Demo2026!Orion</strong>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-8 text-sm text-slate-500 shadow-card">
          Laden…
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}

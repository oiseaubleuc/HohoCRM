import Link from "next/link";
import { ApiStatusBanner } from "@/components/ui/api-status";
import { orionGet } from "@/lib/orion-api";
import { NewInvoiceForm } from "./new-invoice-form";

const backClass = "text-sm font-medium text-accent hover:underline";

export default async function NewInvoicePage() {
  const [clientsRes, projectsRes] = await Promise.all([
    orionGet<{ clients: { id: string; companyName: string }[] }>("/v1/app/clients"),
    orionGet<{ projects: { id: string; title: string }[] }>("/v1/app/projects"),
  ]);

  if (!clientsRes.ok || !projectsRes.ok) {
    const err = !clientsRes.ok ? clientsRes.error : !projectsRes.ok ? projectsRes.error : "";
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Nieuwe factuur</h1>
          <Link href="/invoices" className={backClass}>
            ← Terug naar facturen
          </Link>
        </div>
        <ApiStatusBanner error={err} />
      </div>
    );
  }

  if (clientsRes.data.clients.length === 0) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Nieuwe factuur</h1>
          <Link href="/invoices" className={backClass}>
            ← Terug naar facturen
          </Link>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Je hebt nog geen klanten.{" "}
          <Link href="/clients/new" className="font-medium text-accent hover:underline">
            Maak eerst een klant aan
          </Link>
          .
        </p>
      </div>
    );
  }

  const today = new Date();
  const issue = today.toISOString().slice(0, 10);
  const due = new Date(today);
  due.setDate(due.getDate() + 14);
  const dueStr = due.toISOString().slice(0, 10);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Nieuwe factuur</h1>
        <Link href="/invoices" className={backClass}>
          ← Terug naar facturen
        </Link>
      </div>
      <p className="mt-2 text-sm text-slate-500">Wordt als concept (DRAFT) aangemaakt met automatisch factuurnummer.</p>
      <NewInvoiceForm
        clients={clientsRes.data.clients}
        projects={projectsRes.data.projects}
        defaultIssueDate={issue}
        defaultDueDate={dueStr}
      />
    </div>
  );
}

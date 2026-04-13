import Link from "next/link";
import { ApiStatusBanner } from "@/components/ui/api-status";
import { orionGet } from "@/lib/orion-api";
import { NewProjectForm } from "./new-project-form";

const backClass = "text-sm font-medium text-accent hover:underline";

export default async function NewProjectPage() {
  const res = await orionGet<{ clients: { id: string; companyName: string }[] }>("/v1/app/clients");

  if (!res.ok) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Nieuw project</h1>
          <Link href="/projects" className={backClass}>
            ← Terug naar projecten
          </Link>
        </div>
        <ApiStatusBanner error={res.error} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Nieuw project</h1>
        <Link href="/projects" className={backClass}>
          ← Terug naar projecten
        </Link>
      </div>
      <p className="mt-2 text-sm text-slate-500">Koppel optioneel een bestaande klant.</p>
      <NewProjectForm clients={res.data.clients} />
    </div>
  );
}

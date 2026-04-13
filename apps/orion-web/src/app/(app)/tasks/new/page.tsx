import Link from "next/link";
import { ApiStatusBanner } from "@/components/ui/api-status";
import { orionGet } from "@/lib/orion-api";
import { NewTaskForm } from "./new-task-form";

const backClass = "text-sm font-medium text-accent hover:underline";

export default async function NewTaskPage() {
  const [projectsRes, clientsRes] = await Promise.all([
    orionGet<{ projects: { id: string; title: string }[] }>("/v1/app/projects"),
    orionGet<{ clients: { id: string; companyName: string }[] }>("/v1/app/clients"),
  ]);

  if (!projectsRes.ok || !clientsRes.ok) {
    const err = !projectsRes.ok ? projectsRes.error : !clientsRes.ok ? clientsRes.error : "";
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Nieuwe taak</h1>
          <Link href="/tasks" className={backClass}>
            ← Terug naar taken
          </Link>
        </div>
        <ApiStatusBanner error={err} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Nieuwe taak</h1>
        <Link href="/tasks" className={backClass}>
          ← Terug naar taken
        </Link>
      </div>
      <p className="mt-2 text-sm text-slate-500">Koppel optioneel een project en/of klant.</p>
      <NewTaskForm projects={projectsRes.data.projects} clients={clientsRes.data.clients} />
    </div>
  );
}

import Link from "next/link";
import { ApiStatusBanner } from "@/components/ui/api-status";
import { orionGet } from "@/lib/orion-api";

type Row = {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
  assignee: { name: string | null } | null;
  project: { title: string } | null;
  client: { companyName: string } | null;
};

export default async function TasksPage() {
  const res = await orionGet<{ tasks: Row[] }>("/v1/app/tasks");

  if (!res.ok) {
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Tasks</h1>
        <ApiStatusBanner error={res.error} />
      </div>
    );
  }

  const { tasks } = res.data;

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Tasks</h1>
          <p className="text-sm text-slate-500">{tasks.length} ta(a)k(en) · API</p>
        </div>
        <Link
          href="/tasks/new"
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          Nieuwe taak
        </Link>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-surface shadow-card">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead className="border-b border-border bg-surface-muted/60 text-xs font-medium uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Taak</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Prioriteit</th>
              <th className="px-4 py-3">Deadline</th>
              <th className="px-4 py-3">Toegewezen</th>
              <th className="px-4 py-3">Project / klant</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {tasks.map((t) => (
              <tr key={t.id} className="hover:bg-surface-muted/40">
                <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">{t.title}</td>
                <td className="px-4 py-3">
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs dark:bg-slate-800">{t.status}</span>
                </td>
                <td className="px-4 py-3">{t.priority}</td>
                <td className="px-4 py-3 tabular-nums text-slate-600">
                  {t.dueDate ? new Date(t.dueDate).toLocaleDateString("nl-BE") : "—"}
                </td>
                <td className="px-4 py-3 text-slate-600">{t.assignee?.name ?? "—"}</td>
                <td className="px-4 py-3 text-slate-600">
                  {t.project?.title ?? t.client?.companyName ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {tasks.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-500">Nog geen taken.</p>
        ) : null}
      </div>
    </div>
  );
}

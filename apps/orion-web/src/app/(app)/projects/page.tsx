import { ApiStatusBanner } from "@/components/ui/api-status";
import { orionGet } from "@/lib/orion-api";

type Row = {
  id: string;
  title: string;
  status: string;
  progress: number;
  priority: string;
  deadline: string | null;
  client: { companyName: string } | null;
  taskCount: number;
};

export default async function ProjectsPage() {
  const res = await orionGet<{ projects: Row[] }>("/v1/app/projects");

  if (!res.ok) {
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Projects</h1>
        <ApiStatusBanner error={res.error} />
      </div>
    );
  }

  const { projects } = res.data;

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Projects</h1>
      <p className="text-sm text-slate-500">{projects.length} project(en) · API</p>

      <div className="overflow-x-auto rounded-xl border border-border bg-surface shadow-card">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-border bg-surface-muted/60 text-xs font-medium uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Project</th>
              <th className="px-4 py-3">Klant</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Voortgang</th>
              <th className="px-4 py-3">Deadline</th>
              <th className="px-4 py-3 text-right">Taken</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {projects.map((p) => (
              <tr key={p.id} className="hover:bg-surface-muted/40">
                <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">{p.title}</td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{p.client?.companyName ?? "—"}</td>
                <td className="px-4 py-3">
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs dark:bg-slate-800">{p.status}</span>
                </td>
                <td className="px-4 py-3 tabular-nums">{p.progress}%</td>
                <td className="px-4 py-3 text-slate-600">
                  {p.deadline ? new Date(p.deadline).toLocaleDateString("nl-BE") : "—"}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{p.taskCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {projects.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-500">Nog geen projecten.</p>
        ) : null}
      </div>
    </div>
  );
}

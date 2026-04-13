import { ApiStatusBanner } from "@/components/ui/api-status";
import { orionGet } from "@/lib/orion-api";

type Row = {
  id: string;
  title: string | null;
  startsAt: string;
  endsAt: string | null;
  client: { companyName: string } | null;
  project: { title: string } | null;
  actionItemCount: number;
};

export default async function MeetingsPage() {
  const res = await orionGet<{ meetings: Row[] }>("/v1/app/meetings");

  if (!res.ok) {
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Meetings</h1>
        <ApiStatusBanner error={res.error} />
      </div>
    );
  }

  const { meetings } = res.data;

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Meetings</h1>
      <p className="text-sm text-slate-500">{meetings.length} meeting(s) · API</p>

      <div className="overflow-x-auto rounded-xl border border-border bg-surface shadow-card">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-border bg-surface-muted/60 text-xs font-medium uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Titel / moment</th>
              <th className="px-4 py-3">Klant</th>
              <th className="px-4 py-3">Project</th>
              <th className="px-4 py-3 text-right">Actiepunten</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {meetings.map((m) => (
              <tr key={m.id} className="hover:bg-surface-muted/40">
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-900 dark:text-slate-100">{m.title || "Meeting"}</div>
                  <div className="text-xs text-slate-500">
                    {new Date(m.startsAt).toLocaleString("nl-BE")}
                    {m.endsAt ? ` – ${new Date(m.endsAt).toLocaleTimeString("nl-BE", { hour: "2-digit", minute: "2-digit" })}` : ""}
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-600">{m.client?.companyName ?? "—"}</td>
                <td className="px-4 py-3 text-slate-600">{m.project?.title ?? "—"}</td>
                <td className="px-4 py-3 text-right tabular-nums">{m.actionItemCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {meetings.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-500">Nog geen meetings.</p>
        ) : null}
      </div>
    </div>
  );
}

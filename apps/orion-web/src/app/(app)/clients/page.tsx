import { ApiStatusBanner } from "@/components/ui/api-status";
import { orionGet } from "@/lib/orion-api";

type Row = {
  id: string;
  companyName: string;
  contactName: string | null;
  email: string | null;
  city: string | null;
  status: string;
  projectCount: number;
  invoiceCount: number;
};

export default async function ClientsPage() {
  const res = await orionGet<{ clients: Row[] }>("/v1/app/clients");

  if (!res.ok) {
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Clients</h1>
        <ApiStatusBanner error={res.error} />
      </div>
    );
  }

  const { clients } = res.data;

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Clients</h1>
      <p className="text-sm text-slate-500">{clients.length} klant(en) · API</p>

      <div className="overflow-x-auto rounded-xl border border-border bg-surface shadow-card">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-border bg-surface-muted/60 text-xs font-medium uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Bedrijf</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Projecten</th>
              <th className="px-4 py-3 text-right">Facturen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {clients.map((c) => (
              <tr key={c.id} className="hover:bg-surface-muted/40">
                <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">{c.companyName}</td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                  {[c.contactName, c.email].filter(Boolean).join(" · ") || "—"}
                  {c.city ? <span className="block text-xs text-slate-500">{c.city}</span> : null}
                </td>
                <td className="px-4 py-3">
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs dark:bg-slate-800">{c.status}</span>
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{c.projectCount}</td>
                <td className="px-4 py-3 text-right tabular-nums">{c.invoiceCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {clients.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-500">Nog geen klanten in deze tenant.</p>
        ) : null}
      </div>
    </div>
  );
}

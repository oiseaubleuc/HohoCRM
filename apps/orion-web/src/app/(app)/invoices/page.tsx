import { ApiStatusBanner } from "@/components/ui/api-status";
import { orionGet } from "@/lib/orion-api";

type Row = {
  id: string;
  number: string;
  status: string;
  amountFormatted: string;
  issueDate: string;
  dueDate: string;
  client: { companyName: string } | null;
};

export default async function InvoicesPage() {
  const res = await orionGet<{ invoices: Row[] }>("/v1/app/invoices");

  if (!res.ok) {
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Invoices</h1>
        <ApiStatusBanner error={res.error} />
      </div>
    );
  }

  const { invoices } = res.data;

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Invoices</h1>
      <p className="text-sm text-slate-500">{invoices.length} factu(u)r(en) · API</p>

      <div className="overflow-x-auto rounded-xl border border-border bg-surface shadow-card">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-border bg-surface-muted/60 text-xs font-medium uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Nummer</th>
              <th className="px-4 py-3">Klant</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Bedrag</th>
              <th className="px-4 py-3">Uitgifte</th>
              <th className="px-4 py-3">Vervaldatum</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {invoices.map((inv) => (
              <tr key={inv.id} className="hover:bg-surface-muted/40">
                <td className="px-4 py-3 font-mono text-xs font-medium text-slate-900 dark:text-slate-100">
                  {inv.number}
                </td>
                <td className="px-4 py-3 text-slate-600">{inv.client?.companyName ?? "—"}</td>
                <td className="px-4 py-3">
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs dark:bg-slate-800">{inv.status}</span>
                </td>
                <td className="px-4 py-3 text-right font-medium tabular-nums">{inv.amountFormatted}</td>
                <td className="px-4 py-3 text-slate-600 tabular-nums">
                  {new Date(inv.issueDate).toLocaleDateString("nl-BE")}
                </td>
                <td className="px-4 py-3 text-slate-600 tabular-nums">
                  {new Date(inv.dueDate).toLocaleDateString("nl-BE")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {invoices.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-500">Nog geen facturen.</p>
        ) : null}
      </div>
    </div>
  );
}

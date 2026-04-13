import { ActionCenter } from "@/components/dashboard/action-center";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { ApiStatusBanner } from "@/components/ui/api-status";
import { orionGet } from "@/lib/orion-api";

type DashboardData = {
  kpis: Array<{
    key: string;
    label: string;
    value: string;
    trend: "up" | "down" | "flat";
    trendLabel: string;
    hint: string | null;
  }>;
  actions: Array<{
    id: string;
    title: string;
    meta: string;
    severity: "urgent" | "warning" | "info";
  }>;
  activity: Array<{ id: string; text: string; time: string }>;
  tenant: { name: string; slug: string };
};

export default async function DashboardPage() {
  const res = await orionGet<DashboardData>("/v1/app/dashboard");

  if (!res.ok) {
    return (
      <div className="mx-auto max-w-7xl space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
          Dashboard
        </h1>
        <ApiStatusBanner
          error={res.error}
          hint="Start de API: cd backend && npm start. Zet ORION_BFF_SECRET (zelfde als backend) + DATABASE_URL. Daarna: npx prisma migrate dev && npm run db:seed. Log in op /login."
        />
      </div>
    );
  }

  const { kpis, actions, activity } = res.data;

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
          Dashboard
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Live data · <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">GET /v1/app/dashboard</code> · tenant{" "}
          <span className="font-medium">{res.data.tenant.slug}</span>
        </p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {kpis.map((k) => (
          <KpiCard
            key={k.key}
            label={k.label}
            value={k.value}
            trend={k.trend}
            trendLabel={k.trendLabel}
            hint={k.hint ?? undefined}
          />
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <ActionCenter items={actions} />
        <ActivityFeed items={activity} />
      </section>

      <QuickActions />
    </div>
  );
}

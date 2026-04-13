import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";

export type KpiTrend = "up" | "down" | "flat";

export function KpiCard({
  label,
  value,
  trend,
  trendLabel,
  hint,
  icon,
}: {
  label: string;
  value: string;
  trend: KpiTrend;
  trendLabel: string;
  hint?: string;
  icon?: ReactNode;
}) {
  const trendColor =
    trend === "up"
      ? "text-emerald-600 dark:text-emerald-400"
      : trend === "down"
        ? "text-red-600 dark:text-red-400"
        : "text-slate-500";

  const arrow = trend === "up" ? "↑" : trend === "down" ? "↓" : "→";

  return (
    <div className="rounded-xl border border-border bg-surface p-5 shadow-card transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>
        {icon ? <div className="text-slate-400">{icon}</div> : null}
      </div>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
        {value}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Badge variant={trend === "up" ? "success" : trend === "down" ? "danger" : "neutral"}>
          <span className={trendColor}>
            {arrow} {trendLabel}
          </span>
        </Badge>
        {hint ? <span className="text-xs text-slate-500">{hint}</span> : null}
      </div>
    </div>
  );
}

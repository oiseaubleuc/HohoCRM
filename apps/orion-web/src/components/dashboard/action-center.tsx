import { Badge } from "@/components/ui/badge";

export type ActionItem = {
  id: string;
  title: string;
  meta: string;
  severity: "urgent" | "warning" | "info";
};

const severityVariant = {
  urgent: "danger" as const,
  warning: "warning" as const,
  info: "info" as const,
};

export function ActionCenter({ items }: { items: ActionItem[] }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5 shadow-card">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
        Action center
      </h2>
      <ul className="mt-4 space-y-3">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex items-start justify-between gap-3 rounded-lg border border-border/80 bg-surface-muted/50 px-3 py-2.5"
          >
            <div>
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                {item.title}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">{item.meta}</p>
            </div>
            <Badge variant={severityVariant[item.severity]}>
              {item.severity === "urgent"
                ? "Urgent"
                : item.severity === "warning"
                  ? "Due"
                  : "Today"}
            </Badge>
          </li>
        ))}
      </ul>
    </div>
  );
}

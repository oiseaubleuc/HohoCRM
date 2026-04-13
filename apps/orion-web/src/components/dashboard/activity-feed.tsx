export type ActivityItem = {
  id: string;
  text: string;
  time: string;
};

export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5 shadow-card">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
        Recent activity
      </h2>
      <ul className="mt-4 space-y-4">
        {items.map((item) => (
          <li key={item.id} className="flex gap-3 text-sm">
            <span
              className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent"
              aria-hidden
            />
            <div>
              <p className="text-slate-800 dark:text-slate-200">{item.text}</p>
              <p className="mt-0.5 text-xs text-slate-500">{item.time}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

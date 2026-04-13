import Link from "next/link";
import { NewClientForm } from "./new-client-form";

const backClass =
  "text-sm font-medium text-accent hover:underline";

export default function NewClientPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Nieuwe klant</h1>
        <Link href="/clients" className={backClass}>
          ← Terug naar klanten
        </Link>
      </div>
      <p className="mt-2 text-sm text-slate-500">Maak een klant aan; die verschijnt meteen in de lijst.</p>
      <NewClientForm />
    </div>
  );
}

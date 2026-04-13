import { auth } from "@/auth";
import { AppShell } from "@/components/layout/app-shell";
import { orionGet } from "@/lib/orion-api";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const tenant = await orionGet<{ tenant: { name: string } }>("/v1/app/tenant");
  const tenantName = tenant.ok ? tenant.data.tenant.name : "Orion";

  return (
    <AppShell
      tenantName={tenantName}
      userEmail={session?.user?.email ?? undefined}
      userRole={session?.user?.role ?? undefined}
    >
      {children}
    </AppShell>
  );
}

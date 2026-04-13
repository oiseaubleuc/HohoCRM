"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { orionPost } from "@/lib/orion-api";

export type ClientFormState = { error: string | null };

export async function createClient(
  _prev: ClientFormState,
  formData: FormData
): Promise<ClientFormState> {
  const companyName = String(formData.get("companyName") || "").trim();
  if (!companyName) {
    return { error: "Bedrijfsnaam is verplicht." };
  }
  const res = await orionPost("/v1/app/clients", {
    companyName,
    contactName: String(formData.get("contactName") || "").trim() || undefined,
    email: String(formData.get("email") || "").trim() || undefined,
    city: String(formData.get("city") || "").trim() || undefined,
    status: String(formData.get("status") || "LEAD"),
  });
  if (!res.ok) {
    return { error: res.error };
  }
  revalidatePath("/clients");
  revalidatePath("/dashboard");
  revalidatePath("/projects/new");
  revalidatePath("/tasks/new");
  revalidatePath("/invoices/new");
  redirect("/clients");
}

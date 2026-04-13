"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { orionPost } from "@/lib/orion-api";

export type InvoiceFormState = { error: string | null };

export async function createInvoice(
  _prev: InvoiceFormState,
  formData: FormData
): Promise<InvoiceFormState> {
  const clientId = String(formData.get("clientId") || "").trim();
  if (!clientId) {
    return { error: "Selecteer een klant." };
  }
  const amount = String(formData.get("amount") || "").trim();
  if (!amount) {
    return { error: "Bedrag is verplicht." };
  }
  const issueDate = String(formData.get("issueDate") || "").trim();
  const dueDate = String(formData.get("dueDate") || "").trim();
  if (!issueDate || !dueDate) {
    return { error: "Uitgifte- en vervaldatum zijn verplicht." };
  }
  const projectId = String(formData.get("projectId") || "").trim();
  const res = await orionPost("/v1/app/invoices", {
    clientId,
    amount,
    issueDate,
    dueDate,
    ...(projectId ? { projectId } : {}),
  });
  if (!res.ok) {
    return { error: res.error };
  }
  revalidatePath("/invoices");
  revalidatePath("/dashboard");
  redirect("/invoices");
}

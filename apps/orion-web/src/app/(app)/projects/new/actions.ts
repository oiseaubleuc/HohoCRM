"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { orionPost } from "@/lib/orion-api";

export type ProjectFormState = { error: string | null };

export async function createProject(
  _prev: ProjectFormState,
  formData: FormData
): Promise<ProjectFormState> {
  const title = String(formData.get("title") || "").trim();
  if (!title) {
    return { error: "Projecttitel is verplicht." };
  }
  const clientId = String(formData.get("clientId") || "").trim();
  const res = await orionPost("/v1/app/projects", {
    title,
    ...(clientId ? { clientId } : {}),
    status: String(formData.get("status") || "PLANNED"),
    priority: String(formData.get("priority") || "NORMAL"),
  });
  if (!res.ok) {
    return { error: res.error };
  }
  revalidatePath("/projects");
  revalidatePath("/dashboard");
  revalidatePath("/tasks/new");
  revalidatePath("/invoices/new");
  redirect("/projects");
}

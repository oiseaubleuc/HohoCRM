"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { orionPost } from "@/lib/orion-api";

export type TaskFormState = { error: string | null };

export async function createTask(_prev: TaskFormState, formData: FormData): Promise<TaskFormState> {
  const title = String(formData.get("title") || "").trim();
  if (!title) {
    return { error: "Taaktitel is verplicht." };
  }
  const projectId = String(formData.get("projectId") || "").trim();
  const clientId = String(formData.get("clientId") || "").trim();
  const dueRaw = String(formData.get("dueDate") || "").trim();
  const res = await orionPost("/v1/app/tasks", {
    title,
    ...(projectId ? { projectId } : {}),
    ...(clientId ? { clientId } : {}),
    status: String(formData.get("status") || "TODO"),
    priority: String(formData.get("priority") || "NORMAL"),
    ...(dueRaw ? { dueDate: dueRaw } : {}),
  });
  if (!res.ok) {
    return { error: res.error };
  }
  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  redirect("/tasks");
}

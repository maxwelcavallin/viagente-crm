"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/db";
import { pipelines } from "@/db/schema";

export type CreatePipelineState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; name: string };

export async function createPipelineAction(
  _prevState: CreatePipelineState,
  formData: FormData
): Promise<CreatePipelineState> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { status: "error", message: "Acesso negado." };
  }

  const name = formData.get("name");
  if (typeof name !== "string" || !name.trim()) {
    return { status: "error", message: "Nome é obrigatório." };
  }
  const trimmedName = name.trim();

  const existingPipelines = await db
    .select({ order: pipelines.order })
    .from(pipelines);
  const nextOrder =
    existingPipelines.length > 0
      ? Math.max(...existingPipelines.map((p) => p.order)) + 1
      : 0;

  await db.insert(pipelines).values({ name: trimmedName, order: nextOrder });

  revalidatePath("/admin/pipelines");

  return { status: "success", name: trimmedName };
}

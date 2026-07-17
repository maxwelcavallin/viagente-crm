"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/db";
import { pipelines } from "@/db/schema";
import { clonePipeline } from "@/lib/pipeline-clone";

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

  revalidatePath("/configuracoes/pipelines");

  return { status: "success", name: trimmedName };
}

export type ClonePipelineState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; pipelineId: string };

export async function clonePipelineAction(
  _prevState: ClonePipelineState,
  formData: FormData
): Promise<ClonePipelineState> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { status: "error", message: "Acesso negado." };
  }

  const sourcePipelineId = formData.get("sourcePipelineId");
  const name = formData.get("name");
  if (typeof sourcePipelineId !== "string" || !sourcePipelineId) {
    return { status: "error", message: "Pipeline de origem inválida." };
  }
  if (typeof name !== "string" || !name.trim()) {
    return { status: "error", message: "Nome é obrigatório." };
  }

  const { id } = await clonePipeline(sourcePipelineId, name.trim());

  revalidatePath("/configuracoes/pipelines");

  return { status: "success", pipelineId: id };
}

"use server";

import { count, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/db";
import { deals, pipelines } from "@/db/schema";
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

export type RenamePipelineState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success" };

export async function renamePipelineAction(
  _prevState: RenamePipelineState,
  formData: FormData
): Promise<RenamePipelineState> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { status: "error", message: "Acesso negado." };
  }

  const pipelineId = formData.get("pipelineId");
  const name = formData.get("name");
  if (typeof pipelineId !== "string" || !pipelineId) {
    return { status: "error", message: "Pipeline inválida." };
  }
  if (typeof name !== "string" || !name.trim()) {
    return { status: "error", message: "Nome é obrigatório." };
  }

  await db.update(pipelines).set({ name: name.trim() }).where(eq(pipelines.id, pipelineId));

  revalidatePath("/configuracoes/pipelines");
  return { status: "success" };
}

export type DeletePipelineState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success" };

// Bloqueia a exclusão se houver qualquer negócio na pipeline (em qualquer
// etapa) — decisão explícita: evitar perda de dados por engano em vez de
// cascatear a exclusão dos negócios junto. O admin precisa mover ou excluir
// os negócios antes.
export async function deletePipelineAction(
  _prevState: DeletePipelineState,
  formData: FormData
): Promise<DeletePipelineState> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { status: "error", message: "Acesso negado." };
  }

  const pipelineId = formData.get("pipelineId");
  if (typeof pipelineId !== "string" || !pipelineId) {
    return { status: "error", message: "Pipeline inválida." };
  }

  const [{ dealCount }] = await db
    .select({ dealCount: count() })
    .from(deals)
    .where(eq(deals.pipelineId, pipelineId));
  if (dealCount > 0) {
    return {
      status: "error",
      message: `Essa pipeline tem ${dealCount} negócio${dealCount === 1 ? "" : "s"} — mova ou exclua ${dealCount === 1 ? "ele" : "eles"} antes de excluir a pipeline.`,
    };
  }

  await db.delete(pipelines).where(eq(pipelines.id, pipelineId));

  revalidatePath("/configuracoes/pipelines");
  return { status: "success" };
}

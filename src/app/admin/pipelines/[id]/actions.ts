"use server";

import { asc, count, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/db";
import { deals, stages } from "@/db/schema";

async function requireAdmin() {
  const session = await auth();
  return session?.user?.role === "admin";
}

async function nameConflicts(
  pipelineId: string,
  name: string,
  excludeStageId?: string
) {
  const rows = await db
    .select({ id: stages.id, name: stages.name })
    .from(stages)
    .where(eq(stages.pipelineId, pipelineId));
  const normalized = name.trim().toLowerCase();
  return rows.some(
    (row) => row.id !== excludeStageId && row.name.trim().toLowerCase() === normalized
  );
}

export type StageFormState =
  | { status: "idle" }
  | { status: "error"; message: string };

const initialIdle: StageFormState = { status: "idle" };

export async function createStageAction(
  _prevState: StageFormState,
  formData: FormData
): Promise<StageFormState> {
  if (!(await requireAdmin())) {
    return { status: "error", message: "Acesso negado." };
  }

  const pipelineId = formData.get("pipelineId");
  const name = formData.get("name");
  const color = formData.get("color");

  if (typeof pipelineId !== "string" || !pipelineId) {
    return { status: "error", message: "Pipeline inválida." };
  }
  if (typeof name !== "string" || !name.trim()) {
    return { status: "error", message: "Nome da etapa é obrigatório." };
  }

  if (await nameConflicts(pipelineId, name)) {
    return {
      status: "error",
      message: "Já existe uma etapa com esse nome nesta pipeline.",
    };
  }

  const existingStages = await db
    .select({ order: stages.order })
    .from(stages)
    .where(eq(stages.pipelineId, pipelineId));
  const nextOrder =
    existingStages.length > 0
      ? Math.max(...existingStages.map((s) => s.order)) + 1
      : 0;

  await db.insert(stages).values({
    pipelineId,
    name: name.trim(),
    color: typeof color === "string" && color ? color : null,
    order: nextOrder,
  });

  revalidatePath(`/admin/pipelines/${pipelineId}`);
  return initialIdle;
}

export async function updateStageAction(
  _prevState: StageFormState,
  formData: FormData
): Promise<StageFormState> {
  if (!(await requireAdmin())) {
    return { status: "error", message: "Acesso negado." };
  }

  const id = formData.get("id");
  const pipelineId = formData.get("pipelineId");
  const name = formData.get("name");
  const color = formData.get("color");

  if (typeof id !== "string" || typeof pipelineId !== "string") {
    return { status: "error", message: "Etapa inválida." };
  }
  if (typeof name !== "string" || !name.trim()) {
    return { status: "error", message: "Nome da etapa é obrigatório." };
  }

  if (await nameConflicts(pipelineId, name, id)) {
    return {
      status: "error",
      message: "Já existe uma etapa com esse nome nesta pipeline.",
    };
  }

  await db
    .update(stages)
    .set({
      name: name.trim(),
      color: typeof color === "string" && color ? color : null,
    })
    .where(eq(stages.id, id));

  revalidatePath(`/admin/pipelines/${pipelineId}`);
  return initialIdle;
}

export async function deleteStageAction(
  _prevState: StageFormState,
  formData: FormData
): Promise<StageFormState> {
  if (!(await requireAdmin())) {
    return { status: "error", message: "Acesso negado." };
  }

  const id = formData.get("id");
  const pipelineId = formData.get("pipelineId");
  if (typeof id !== "string" || typeof pipelineId !== "string") {
    return { status: "error", message: "Etapa inválida." };
  }

  const [{ dealCount }] = await db
    .select({ dealCount: count(deals.id) })
    .from(deals)
    .where(eq(deals.stageId, id));

  if (dealCount > 0) {
    return {
      status: "error",
      message: `Não é possível excluir: ${dealCount} negócio(s) estão nesta etapa. Mova-os para outra etapa antes de excluir.`,
    };
  }

  await db.delete(stages).where(eq(stages.id, id));

  revalidatePath(`/admin/pipelines/${pipelineId}`);
  return initialIdle;
}

export async function moveStageAction(formData: FormData): Promise<void> {
  if (!(await requireAdmin())) return;

  const id = formData.get("id");
  const pipelineId = formData.get("pipelineId");
  const direction = formData.get("direction");
  if (
    typeof id !== "string" ||
    typeof pipelineId !== "string" ||
    (direction !== "up" && direction !== "down")
  ) {
    return;
  }

  const pipelineStages = await db
    .select({ id: stages.id, order: stages.order })
    .from(stages)
    .where(eq(stages.pipelineId, pipelineId))
    .orderBy(asc(stages.order));

  const index = pipelineStages.findIndex((s) => s.id === id);
  const neighborIndex = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || neighborIndex < 0 || neighborIndex >= pipelineStages.length) {
    return;
  }

  const current = pipelineStages[index];
  const neighbor = pipelineStages[neighborIndex];

  // neon-http não suporta db.transaction() (transação interativa via HTTP);
  // db.batch() envia as duas queries num único round-trip atômico via
  // @neondatabase/serverless.
  await db.batch([
    db
      .update(stages)
      .set({ order: neighbor.order })
      .where(eq(stages.id, current.id)),
    db
      .update(stages)
      .set({ order: current.order })
      .where(eq(stages.id, neighbor.id)),
  ]);

  revalidatePath(`/admin/pipelines/${pipelineId}`);
}

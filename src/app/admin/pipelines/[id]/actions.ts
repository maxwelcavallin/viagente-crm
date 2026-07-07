"use server";

import { asc, count, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/db";
import { deals, stages, stageTasks } from "@/db/schema";

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

// Usado pelo drag-and-drop (seção 4 do design system): recebe a ordem final
// completa (lista de ids) e regrava o campo "order" de todas de uma vez.
export async function reorderStagesAction(
  pipelineId: string,
  orderedIds: string[]
): Promise<{ ok: boolean }> {
  if (!(await requireAdmin())) return { ok: false };
  if (orderedIds.length === 0) return { ok: true };

  const updates = orderedIds.map((id, index) =>
    db.update(stages).set({ order: index }).where(eq(stages.id, id))
  );
  await db.batch(updates as [(typeof updates)[number], ...(typeof updates)[number][]]);

  revalidatePath(`/admin/pipelines/${pipelineId}`);
  return { ok: true };
}

// ---------- Tarefas automáticas por etapa (stage_tasks) ----------

export type StageTaskFormState =
  | { status: "idle" }
  | { status: "error"; message: string };

const stageTaskIdle: StageTaskFormState = { status: "idle" };

export async function createStageTaskAction(
  _prevState: StageTaskFormState,
  formData: FormData
): Promise<StageTaskFormState> {
  if (!(await requireAdmin())) {
    return { status: "error", message: "Acesso negado." };
  }

  const stageId = formData.get("stageId");
  const pipelineId = formData.get("pipelineId");
  const title = formData.get("title");
  const type = formData.get("type");
  const messageTemplateId = formData.get("messageTemplateId");

  if (typeof stageId !== "string" || typeof pipelineId !== "string") {
    return { status: "error", message: "Etapa inválida." };
  }
  if (typeof title !== "string" || !title.trim()) {
    return { status: "error", message: "Título é obrigatório." };
  }
  if (
    type !== "mensagem" &&
    type !== "ligacao" &&
    type !== "agendamento" &&
    type !== "generica"
  ) {
    return { status: "error", message: "Tipo inválido." };
  }
  if (type === "mensagem" && (typeof messageTemplateId !== "string" || !messageTemplateId)) {
    return {
      status: "error",
      message: "Selecione um template para tarefas do tipo mensagem.",
    };
  }

  const existing = await db
    .select({ order: stageTasks.order })
    .from(stageTasks)
    .where(eq(stageTasks.stageId, stageId));
  const nextOrder =
    existing.length > 0 ? Math.max(...existing.map((s) => s.order)) + 1 : 0;

  await db.insert(stageTasks).values({
    stageId,
    title: title.trim(),
    type,
    messageTemplateId: type === "mensagem" ? (messageTemplateId as string) : null,
    order: nextOrder,
  });

  revalidatePath(`/admin/pipelines/${pipelineId}`);
  return stageTaskIdle;
}

export async function updateStageTaskAction(
  _prevState: StageTaskFormState,
  formData: FormData
): Promise<StageTaskFormState> {
  if (!(await requireAdmin())) {
    return { status: "error", message: "Acesso negado." };
  }

  const id = formData.get("id");
  const pipelineId = formData.get("pipelineId");
  const title = formData.get("title");
  const messageTemplateId = formData.get("messageTemplateId");

  if (typeof id !== "string" || typeof pipelineId !== "string") {
    return { status: "error", message: "Tarefa inválida." };
  }
  if (typeof title !== "string" || !title.trim()) {
    return { status: "error", message: "Título é obrigatório." };
  }

  const [current] = await db
    .select({ type: stageTasks.type })
    .from(stageTasks)
    .where(eq(stageTasks.id, id))
    .limit(1);
  if (!current) return { status: "error", message: "Tarefa não encontrada." };

  if (current.type === "mensagem" && (typeof messageTemplateId !== "string" || !messageTemplateId)) {
    return {
      status: "error",
      message: "Selecione um template para tarefas do tipo mensagem.",
    };
  }

  await db
    .update(stageTasks)
    .set({
      title: title.trim(),
      messageTemplateId:
        current.type === "mensagem" ? (messageTemplateId as string) : null,
    })
    .where(eq(stageTasks.id, id));

  revalidatePath(`/admin/pipelines/${pipelineId}`);
  return stageTaskIdle;
}

export async function deleteStageTaskAction(
  _prevState: StageTaskFormState,
  formData: FormData
): Promise<StageTaskFormState> {
  if (!(await requireAdmin())) {
    return { status: "error", message: "Acesso negado." };
  }

  const id = formData.get("id");
  const pipelineId = formData.get("pipelineId");
  if (typeof id !== "string" || typeof pipelineId !== "string") {
    return { status: "error", message: "Tarefa inválida." };
  }

  await db.delete(stageTasks).where(eq(stageTasks.id, id));

  revalidatePath(`/admin/pipelines/${pipelineId}`);
  return stageTaskIdle;
}

export async function moveStageTaskAction(formData: FormData): Promise<void> {
  if (!(await requireAdmin())) return;

  const id = formData.get("id");
  const stageId = formData.get("stageId");
  const pipelineId = formData.get("pipelineId");
  const direction = formData.get("direction");
  if (
    typeof id !== "string" ||
    typeof stageId !== "string" ||
    typeof pipelineId !== "string" ||
    (direction !== "up" && direction !== "down")
  ) {
    return;
  }

  const tasksForStage = await db
    .select({ id: stageTasks.id, order: stageTasks.order })
    .from(stageTasks)
    .where(eq(stageTasks.stageId, stageId))
    .orderBy(asc(stageTasks.order));

  const index = tasksForStage.findIndex((t) => t.id === id);
  const neighborIndex = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || neighborIndex < 0 || neighborIndex >= tasksForStage.length) {
    return;
  }

  const current = tasksForStage[index];
  const neighbor = tasksForStage[neighborIndex];

  await db.batch([
    db
      .update(stageTasks)
      .set({ order: neighbor.order })
      .where(eq(stageTasks.id, current.id)),
    db
      .update(stageTasks)
      .set({ order: current.order })
      .where(eq(stageTasks.id, neighbor.id)),
  ]);

  revalidatePath(`/admin/pipelines/${pipelineId}`);
}

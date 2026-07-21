"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/db";
import { automationSequenceSteps, automationSequences } from "@/db/schema";

async function requireAdmin() {
  const session = await auth();
  return session?.user?.role === "admin";
}

export type SequenceFormState =
  | { status: "idle" }
  | { status: "error"; message: string };

const idle: SequenceFormState = { status: "idle" };

type StepInput = {
  delayMinutes: number;
  type: "mensagem" | "tarefa_generica" | "tag" | "mudar_etapa" | "clonar_negocio";
  title: string | null;
  messageTemplateId: string | null;
  autoSend: boolean;
  autoSendChannelId: string | null;
  addTagId: string | null;
  moveToStageId: string | null;
};

type ConditionInput = { field: string; operator: "eq" | "gt" | "lt" | "contains"; value: string } | null;

function parseSteps(raw: FormDataEntryValue | null): StepInput[] | null {
  if (typeof raw !== "string") return null;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function parseConditions(raw: FormDataEntryValue | null): ConditionInput {
  if (typeof raw !== "string" || !raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

type CommonFields = {
  name: string;
  active: boolean;
  triggerType: "etapa" | "tag" | "sem_resposta" | "ganho" | "perdido";
  triggerStageId: string | null;
  triggerTagId: string | null;
  triggerPipelineId: string | null;
  noResponseDays: number | null;
  conditions: ConditionInput;
  steps: StepInput[];
};

function readCommonFields(formData: FormData): CommonFields | { error: string } {
  const name = formData.get("name");
  const active = formData.get("active") === "true";
  const triggerType = formData.get("triggerType");
  const triggerStageId = formData.get("triggerStageId");
  const triggerTagId = formData.get("triggerTagId");
  const triggerPipelineId = formData.get("triggerPipelineId");
  const noResponseDaysRaw = formData.get("noResponseDays");
  const steps = parseSteps(formData.get("steps"));
  const conditions = parseConditions(formData.get("conditions"));

  if (typeof name !== "string" || !name.trim()) {
    return { error: "Nome é obrigatório." };
  }
  if (
    triggerType !== "etapa" &&
    triggerType !== "tag" &&
    triggerType !== "sem_resposta" &&
    triggerType !== "ganho" &&
    triggerType !== "perdido"
  ) {
    return { error: "Gatilho inválido." };
  }
  if (triggerType === "etapa" && (typeof triggerStageId !== "string" || !triggerStageId)) {
    return { error: "Selecione a etapa que dispara a sequência." };
  }
  if (triggerType === "tag" && (typeof triggerTagId !== "string" || !triggerTagId)) {
    return { error: "Selecione a tag que dispara a sequência." };
  }
  if (
    (triggerType === "ganho" || triggerType === "perdido") &&
    (typeof triggerPipelineId !== "string" || !triggerPipelineId)
  ) {
    return { error: "Selecione a pipeline que dispara a sequência." };
  }
  const noResponseDays =
    typeof noResponseDaysRaw === "string" && noResponseDaysRaw ? Number(noResponseDaysRaw) : null;
  if (triggerType === "sem_resposta" && (!noResponseDays || noResponseDays <= 0)) {
    return { error: "Informe depois de quantos dias sem resposta a sequência dispara." };
  }
  if (!steps || steps.length === 0) {
    return { error: "Adicione pelo menos um passo." };
  }
  for (const step of steps) {
    if (step.type === "mensagem" && !step.messageTemplateId) {
      return { error: "Todo passo de mensagem precisa de um template." };
    }
    if (step.type === "tarefa_generica" && !step.title?.trim()) {
      return { error: "Todo passo de tarefa genérica precisa de um título." };
    }
    if (step.type === "tag" && !step.addTagId) {
      return { error: "Todo passo de tag precisa de uma tag selecionada." };
    }
    if (step.type === "mudar_etapa" && !step.moveToStageId) {
      return { error: "Todo passo de mover negócio precisa de uma etapa de destino." };
    }
    if (step.type === "clonar_negocio" && !step.moveToStageId) {
      return { error: "Todo passo de clonar negócio precisa de uma etapa de destino." };
    }
  }

  return {
    name: name.trim(),
    active,
    triggerType: triggerType as "etapa" | "tag" | "sem_resposta" | "ganho" | "perdido",
    triggerStageId: triggerType === "etapa" ? (triggerStageId as string) : null,
    triggerTagId: triggerType === "tag" ? (triggerTagId as string) : null,
    triggerPipelineId:
      triggerType === "ganho" || triggerType === "perdido" ? (triggerPipelineId as string) : null,
    noResponseDays: triggerType === "sem_resposta" ? noResponseDays : null,
    conditions,
    steps,
  };
}

export async function createSequenceAction(
  _prevState: SequenceFormState,
  formData: FormData
): Promise<SequenceFormState> {
  if (!(await requireAdmin())) return { status: "error", message: "Acesso negado." };

  const fields = readCommonFields(formData);
  if ("error" in fields) return { status: "error", message: fields.error };

  const [created] = await db
    .insert(automationSequences)
    .values({
      name: fields.name,
      active: fields.active,
      triggerType: fields.triggerType,
      triggerStageId: fields.triggerStageId,
      triggerTagId: fields.triggerTagId,
      triggerPipelineId: fields.triggerPipelineId,
      noResponseDays: fields.noResponseDays,
      conditions: fields.conditions,
    })
    .returning({ id: automationSequences.id });

  await db.insert(automationSequenceSteps).values(
    fields.steps.map((step, index) => ({
      sequenceId: created.id,
      order: index,
      delayMinutes: step.delayMinutes,
      type: step.type,
      title: step.title,
      messageTemplateId: step.messageTemplateId,
      autoSend: step.autoSend,
      autoSendChannelId: step.autoSendChannelId,
      addTagId: step.addTagId,
      moveToStageId: step.moveToStageId,
    }))
  );

  revalidatePath("/configuracoes/sequencias");
  return idle;
}

export async function updateSequenceAction(
  _prevState: SequenceFormState,
  formData: FormData
): Promise<SequenceFormState> {
  if (!(await requireAdmin())) return { status: "error", message: "Acesso negado." };

  const id = formData.get("id");
  if (typeof id !== "string" || !id) return { status: "error", message: "Sequência inválida." };

  const fields = readCommonFields(formData);
  if ("error" in fields) return { status: "error", message: fields.error };

  await db
    .update(automationSequences)
    .set({
      name: fields.name,
      active: fields.active,
      triggerType: fields.triggerType,
      triggerStageId: fields.triggerStageId,
      triggerTagId: fields.triggerTagId,
      triggerPipelineId: fields.triggerPipelineId,
      noResponseDays: fields.noResponseDays,
      conditions: fields.conditions,
    })
    .where(eq(automationSequences.id, id));

  // Substitui todos os passos de uma vez (delete + insert) — mais simples
  // que diff granular, e não precisa ser atômico com o update acima (mesmo
  // nível de rigor das demais actions deste projeto, ver reorderStagesAction).
  const insertValues = fields.steps.map((step, index) => ({
    sequenceId: id,
    order: index,
    delayMinutes: step.delayMinutes,
    type: step.type,
    title: step.title,
    messageTemplateId: step.messageTemplateId,
    autoSend: step.autoSend,
    autoSendChannelId: step.autoSendChannelId,
    addTagId: step.addTagId,
    moveToStageId: step.moveToStageId,
  }));
  await db.batch([
    db.delete(automationSequenceSteps).where(eq(automationSequenceSteps.sequenceId, id)),
    db.insert(automationSequenceSteps).values(insertValues),
  ]);

  revalidatePath("/configuracoes/sequencias");
  return idle;
}

export async function deleteSequenceAction(
  _prevState: SequenceFormState,
  formData: FormData
): Promise<SequenceFormState> {
  if (!(await requireAdmin())) return { status: "error", message: "Acesso negado." };

  const id = formData.get("id");
  if (typeof id !== "string" || !id) return { status: "error", message: "Sequência inválida." };

  await db.delete(automationSequences).where(eq(automationSequences.id, id));

  revalidatePath("/configuracoes/sequencias");
  return idle;
}

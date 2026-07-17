"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/db";
import { autoDealSettings } from "@/db/schema";

async function requireAdmin() {
  const session = await auth();
  return session?.user?.role === "admin";
}

export type SaveAutoDealSettingsState =
  | { status: "idle" }
  | { status: "error"; message: string };

const idle: SaveAutoDealSettingsState = { status: "idle" };

export async function saveAutoDealSettingsAction(
  _prevState: SaveAutoDealSettingsState,
  formData: FormData
): Promise<SaveAutoDealSettingsState> {
  if (!(await requireAdmin())) {
    return { status: "error", message: "Acesso negado." };
  }

  const active = formData.get("active") === "on";
  const pipelineIdRaw = formData.get("pipelineId");
  const pipelineId = typeof pipelineIdRaw === "string" && pipelineIdRaw ? pipelineIdRaw : null;
  const stageIdRaw = formData.get("stageId");
  const stageId = typeof stageIdRaw === "string" && stageIdRaw ? stageIdRaw : null;

  if (active && (!pipelineId || !stageId)) {
    return { status: "error", message: "Selecione a pipeline e a etapa pra ativar." };
  }

  const values = { active, pipelineId, stageId };

  const [existing] = await db.select({ id: autoDealSettings.id }).from(autoDealSettings).limit(1);
  if (existing) {
    await db.update(autoDealSettings).set(values).where(eq(autoDealSettings.id, existing.id));
  } else {
    await db.insert(autoDealSettings).values(values);
  }

  revalidatePath("/configuracoes/negocio-automatico");
  return idle;
}

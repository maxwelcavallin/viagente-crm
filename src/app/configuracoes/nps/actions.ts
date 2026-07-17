"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/db";
import { npsSettings } from "@/db/schema";

async function requireAdmin() {
  const session = await auth();
  return session?.user?.role === "admin";
}

export type SaveNpsSettingsState =
  | { status: "idle" }
  | { status: "error"; message: string };

const idle: SaveNpsSettingsState = { status: "idle" };

export async function saveNpsSettingsAction(
  _prevState: SaveNpsSettingsState,
  formData: FormData
): Promise<SaveNpsSettingsState> {
  if (!(await requireAdmin())) {
    return { status: "error", message: "Acesso negado." };
  }

  const active = formData.get("active") === "on";
  const triggerOnWon = formData.get("triggerOnWon") === "on";
  const triggerStageIdRaw = formData.get("triggerStageId");
  const triggerStageId =
    typeof triggerStageIdRaw === "string" && triggerStageIdRaw ? triggerStageIdRaw : null;
  const delayDaysRaw = formData.get("delayDays");
  const delayDays = typeof delayDaysRaw === "string" ? parseInt(delayDaysRaw, 10) : NaN;
  const channelIdRaw = formData.get("channelId");
  const channelId = typeof channelIdRaw === "string" && channelIdRaw ? channelIdRaw : null;
  const messageTemplateIdRaw = formData.get("messageTemplateId");
  const messageTemplateId =
    typeof messageTemplateIdRaw === "string" && messageTemplateIdRaw ? messageTemplateIdRaw : null;

  if (!triggerStageId && !triggerOnWon) {
    return { status: "error", message: "Escolha ao menos um gatilho: etapa ou negócio ganho." };
  }
  if (!Number.isFinite(delayDays) || delayDays < 0) {
    return { status: "error", message: "Prazo de envio inválido." };
  }
  if (active && (!channelId || !messageTemplateId)) {
    return { status: "error", message: "Selecione o canal e o template pra ativar o envio." };
  }

  const values = {
    active,
    triggerStageId,
    triggerOnWon,
    delayDays,
    channelId,
    messageTemplateId,
  };

  const [existing] = await db.select({ id: npsSettings.id }).from(npsSettings).limit(1);
  if (existing) {
    await db.update(npsSettings).set(values).where(eq(npsSettings.id, existing.id));
  } else {
    await db.insert(npsSettings).values(values);
  }

  revalidatePath("/configuracoes/nps");
  return idle;
}

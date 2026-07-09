"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/db";
import { whatsappChannels } from "@/db/schema";
import { decryptCredential, encryptCredential } from "@/lib/credentials-crypto";
import { checkZapiStatus } from "@/lib/zapi";

async function requireAdmin() {
  const session = await auth();
  return session?.user?.role === "admin";
}

export type ChannelFormState =
  | { status: "idle" }
  | { status: "error"; message: string };

const idle: ChannelFormState = { status: "idle" };

export async function createChannelAction(
  _prevState: ChannelFormState,
  formData: FormData
): Promise<ChannelFormState> {
  if (!(await requireAdmin())) {
    return { status: "error", message: "Acesso negado." };
  }

  const label = formData.get("label");
  const zapiInstanceId = formData.get("zapiInstanceId");
  const zapiToken = formData.get("zapiToken");
  const zapiClientToken = formData.get("zapiClientToken");
  const phoneNumber = formData.get("phoneNumber");

  if (
    typeof label !== "string" ||
    !label.trim() ||
    typeof zapiInstanceId !== "string" ||
    !zapiInstanceId.trim() ||
    typeof zapiToken !== "string" ||
    !zapiToken.trim() ||
    typeof zapiClientToken !== "string" ||
    !zapiClientToken.trim()
  ) {
    return {
      status: "error",
      message: "Nome, instance ID, token e client-token são obrigatórios.",
    };
  }

  await db.insert(whatsappChannels).values({
    label: label.trim(),
    zapiInstanceId: zapiInstanceId.trim(),
    zapiToken: encryptCredential(zapiToken.trim()),
    zapiClientToken: encryptCredential(zapiClientToken.trim()),
    phoneNumber: typeof phoneNumber === "string" && phoneNumber.trim() ? phoneNumber.trim() : null,
  });

  revalidatePath("/configuracoes/whatsapp");
  return idle;
}

export async function testConnectionAction(
  _prevState: ChannelFormState,
  formData: FormData
): Promise<ChannelFormState> {
  if (!(await requireAdmin())) {
    return { status: "error", message: "Acesso negado." };
  }

  const channelId = formData.get("channelId");
  if (typeof channelId !== "string") {
    return { status: "error", message: "Canal inválido." };
  }

  const [channel] = await db
    .select()
    .from(whatsappChannels)
    .where(eq(whatsappChannels.id, channelId))
    .limit(1);
  if (!channel) {
    return { status: "error", message: "Canal não encontrado." };
  }

  const result = await checkZapiStatus({
    zapiInstanceId: channel.zapiInstanceId,
    zapiToken: decryptCredential(channel.zapiToken),
    zapiClientToken: decryptCredential(channel.zapiClientToken),
  });

  await db
    .update(whatsappChannels)
    .set({ status: result.connected ? "conectado" : "desconectado" })
    .where(eq(whatsappChannels.id, channelId));

  revalidatePath("/configuracoes/whatsapp");

  if (!result.connected) {
    return {
      status: "error",
      message: result.error
        ? `Instância desconectada: ${result.error}`
        : "Instância desconectada.",
    };
  }
  return idle;
}

export async function setDefaultChannelAction(formData: FormData): Promise<void> {
  if (!(await requireAdmin())) return;

  const channelId = formData.get("channelId");
  if (typeof channelId !== "string") return;

  // neon-http não suporta db.transaction(); db.batch() manda as duas updates
  // atomicamente num único round-trip (mesmo padrão da Etapa 4).
  await db.batch([
    db.update(whatsappChannels).set({ isDefault: false }),
    db
      .update(whatsappChannels)
      .set({ isDefault: true })
      .where(eq(whatsappChannels.id, channelId)),
  ]);

  revalidatePath("/configuracoes/whatsapp");
}

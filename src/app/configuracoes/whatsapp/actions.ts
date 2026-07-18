"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/db";
import { whatsappChannels } from "@/db/schema";
import { decryptCredential, encryptCredential } from "@/lib/credentials-crypto";
import { checkZapiStatus, enableZapiNotifySentByMe } from "@/lib/zapi";

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

  const creds = {
    zapiInstanceId: zapiInstanceId.trim(),
    zapiToken: zapiToken.trim(),
    zapiClientToken: zapiClientToken.trim(),
  };

  await db.insert(whatsappChannels).values({
    label: label.trim(),
    zapiInstanceId: creds.zapiInstanceId,
    zapiToken: encryptCredential(creds.zapiToken),
    zapiClientToken: encryptCredential(creds.zapiClientToken),
    phoneNumber: typeof phoneNumber === "string" && phoneNumber.trim() ? phoneNumber.trim() : null,
  });

  // Best-effort — token já é válido nesse ponto (canal já foi criado); só
  // loga se falhar, não bloqueia a criação do canal em si.
  await enableZapiNotifySentByMe(creds).catch((error) => {
    console.error("[whatsapp createChannelAction] falha ao habilitar notifySentByMe", error);
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

  const creds = {
    zapiInstanceId: channel.zapiInstanceId,
    zapiToken: decryptCredential(channel.zapiToken),
    zapiClientToken: decryptCredential(channel.zapiClientToken),
  };
  const result = await checkZapiStatus(creds);

  // Reafirma a cada teste — idempotente do lado da Z-API, e conserta de
  // graça um canal que ficou conectado mas nunca teve isso habilitado (bug
  // corrigido nesta sessão), sem precisar recriar o canal.
  if (result.connected) {
    await enableZapiNotifySentByMe(creds).catch((error) => {
      console.error("[whatsapp testConnectionAction] falha ao habilitar notifySentByMe", error);
    });
  }

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

export async function updateChannelAction(
  _prevState: ChannelFormState,
  formData: FormData
): Promise<ChannelFormState> {
  if (!(await requireAdmin())) {
    return { status: "error", message: "Acesso negado." };
  }

  const id = formData.get("id");
  const label = formData.get("label");
  const zapiInstanceId = formData.get("zapiInstanceId");
  const zapiToken = formData.get("zapiToken");
  const zapiClientToken = formData.get("zapiClientToken");
  const phoneNumber = formData.get("phoneNumber");

  if (typeof id !== "string" || !id) {
    return { status: "error", message: "Canal inválido." };
  }
  if (
    typeof label !== "string" ||
    !label.trim() ||
    typeof zapiInstanceId !== "string" ||
    !zapiInstanceId.trim()
  ) {
    return { status: "error", message: "Nome e instance ID são obrigatórios." };
  }

  // Token/client-token em branco = mantém o valor já salvo — evita forçar
  // o admin a redigitar credenciais só pra trocar o nome do canal, por
  // exemplo.
  const updates: Partial<typeof whatsappChannels.$inferInsert> = {
    label: label.trim(),
    zapiInstanceId: zapiInstanceId.trim(),
    phoneNumber:
      typeof phoneNumber === "string" && phoneNumber.trim()
        ? phoneNumber.trim()
        : null,
  };
  if (typeof zapiToken === "string" && zapiToken.trim()) {
    updates.zapiToken = encryptCredential(zapiToken.trim());
  }
  if (typeof zapiClientToken === "string" && zapiClientToken.trim()) {
    updates.zapiClientToken = encryptCredential(zapiClientToken.trim());
  }

  await db.update(whatsappChannels).set(updates).where(eq(whatsappChannels.id, id));

  revalidatePath("/configuracoes/whatsapp");
  return idle;
}

export async function deleteChannelAction(
  _prevState: ChannelFormState,
  formData: FormData
): Promise<ChannelFormState> {
  if (!(await requireAdmin())) {
    return { status: "error", message: "Acesso negado." };
  }

  const id = formData.get("id");
  if (typeof id !== "string" || !id) {
    return { status: "error", message: "Canal inválido." };
  }

  await db.delete(whatsappChannels).where(eq(whatsappChannels.id, id));

  revalidatePath("/configuracoes/whatsapp");
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

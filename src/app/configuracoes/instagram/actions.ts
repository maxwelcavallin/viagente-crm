"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/db";
import { instagramChannels } from "@/db/schema";
import { decryptCredential } from "@/lib/credentials-crypto";
import { checkInstagramStatus, subscribeInstagramWebhook } from "@/lib/instagram-graph";

async function requireAdmin() {
  const session = await auth();
  return session?.user?.role === "admin";
}

export type ChannelFormState =
  | { status: "idle" }
  | { status: "error"; message: string };

const idle: ChannelFormState = { status: "idle" };

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
    .from(instagramChannels)
    .where(eq(instagramChannels.id, channelId))
    .limit(1);
  if (!channel) {
    return { status: "error", message: "Canal não encontrado." };
  }

  const rawAccessToken = decryptCredential(channel.accessToken);
  const result = await checkInstagramStatus(rawAccessToken);
  // Reafirma a inscrição de webhook a cada teste — idempotente do lado do
  // Meta, e conserta de graça uma conta que ficou conectada mas nunca foi
  // inscrita (bug corrigido nesta sessão), sem precisar reconectar do zero.
  if (result.connected) {
    await subscribeInstagramWebhook(rawAccessToken).catch((error) => {
      console.error("[instagram testConnectionAction] falha ao inscrever webhook", error);
    });
  }

  await db
    .update(instagramChannels)
    .set({ status: result.connected ? "conectado" : "desconectado" })
    .where(eq(instagramChannels.id, channelId));

  revalidatePath("/configuracoes/instagram");

  if (!result.connected) {
    return {
      status: "error",
      message: result.error ? `Conta desconectada: ${result.error}` : "Conta desconectada.",
    };
  }
  return idle;
}

export async function renameChannelAction(
  _prevState: ChannelFormState,
  formData: FormData
): Promise<ChannelFormState> {
  if (!(await requireAdmin())) {
    return { status: "error", message: "Acesso negado." };
  }

  const id = formData.get("id");
  const label = formData.get("label");
  if (typeof id !== "string" || !id) {
    return { status: "error", message: "Canal inválido." };
  }
  if (typeof label !== "string" || !label.trim()) {
    return { status: "error", message: "Nome é obrigatório." };
  }

  await db.update(instagramChannels).set({ label: label.trim() }).where(eq(instagramChannels.id, id));

  revalidatePath("/configuracoes/instagram");
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

  await db.delete(instagramChannels).where(eq(instagramChannels.id, id));

  revalidatePath("/configuracoes/instagram");
  return idle;
}

export async function setDefaultChannelAction(formData: FormData): Promise<void> {
  if (!(await requireAdmin())) return;

  const channelId = formData.get("channelId");
  if (typeof channelId !== "string") return;

  // neon-http não suporta db.transaction(); db.batch() manda as duas updates
  // atomicamente num único round-trip (mesmo padrão do canal WhatsApp).
  await db.batch([
    db.update(instagramChannels).set({ isDefault: false }),
    db
      .update(instagramChannels)
      .set({ isDefault: true })
      .where(eq(instagramChannels.id, channelId)),
  ]);

  revalidatePath("/configuracoes/instagram");
}

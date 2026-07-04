import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { whatsappChannelRestrictions, whatsappChannels } from "@/db/schema";

// Modelo de bloqueio (não de liberação): por padrão todo atendente vê todos
// os canais; uma linha em whatsapp_channel_restrictions BLOQUEIA o usuário
// daquele canal. role='admin' sempre vê tudo, sem exceção (ver seção 7 da spec).

export async function getAllowedChannelIds(
  userId: string,
  role: "admin" | "atendente"
): Promise<string[]> {
  const allChannels = await db
    .select({ id: whatsappChannels.id })
    .from(whatsappChannels);
  const allIds = allChannels.map((c) => c.id);

  if (role === "admin") return allIds;

  const restrictions = await db
    .select({ channelId: whatsappChannelRestrictions.channelId })
    .from(whatsappChannelRestrictions)
    .where(eq(whatsappChannelRestrictions.userId, userId));
  const blockedIds = new Set(restrictions.map((r) => r.channelId));

  return allIds.filter((id) => !blockedIds.has(id));
}

export async function userHasChannelAccess(
  userId: string,
  role: "admin" | "atendente",
  channelId: string
): Promise<boolean> {
  if (role === "admin") return true;

  const [restriction] = await db
    .select({ id: whatsappChannelRestrictions.id })
    .from(whatsappChannelRestrictions)
    .where(
      and(
        eq(whatsappChannelRestrictions.userId, userId),
        eq(whatsappChannelRestrictions.channelId, channelId)
      )
    )
    .limit(1);

  return !restriction;
}

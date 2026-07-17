import { and, eq, notInArray } from "drizzle-orm";
import { db } from "@/db";
import { users, whatsappChannelRestrictions, whatsappChannels } from "@/db/schema";

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

// Inverso de getAllowedChannelIds: dado um canal, quem tem acesso a ele —
// todo admin, mais todo atendente que não tenha uma linha de restrição
// pra esse canal específico (ver modelo de bloqueio no topo do arquivo).
export async function getUsersWithChannelAccess(channelId: string): Promise<string[]> {
  const restricted = await db
    .select({ userId: whatsappChannelRestrictions.userId })
    .from(whatsappChannelRestrictions)
    .where(eq(whatsappChannelRestrictions.channelId, channelId));
  const restrictedIds = restricted.map((r) => r.userId);

  const allowed = await db
    .select({ id: users.id })
    .from(users)
    .where(restrictedIds.length > 0 ? notInArray(users.id, restrictedIds) : undefined);

  return allowed.map((u) => u.id);
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

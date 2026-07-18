import { and, eq, notInArray } from "drizzle-orm";
import { db } from "@/db";
import {
  instagramChannelRestrictions,
  instagramChannels,
  users,
  whatsappChannelRestrictions,
  whatsappChannels,
} from "@/db/schema";

// Modelo de bloqueio (não de liberação): por padrão todo atendente vê todos
// os canais (WhatsApp ou Instagram); uma linha em *_channel_restrictions
// BLOQUEIA o usuário daquele canal específico. role='admin' sempre vê tudo,
// sem exceção (ver seção 7 da spec). channelId não é FK'd a uma tabela só
// (mesmo raciocínio de messages.channelId — ver Etapa 25), então as duas
// tabelas de restrição são checadas separadamente e unidas.

export async function getAllowedChannelIds(
  userId: string,
  role: "admin" | "atendente"
): Promise<string[]> {
  const [whatsappRows, instagramRows] = await Promise.all([
    db.select({ id: whatsappChannels.id }).from(whatsappChannels),
    db.select({ id: instagramChannels.id }).from(instagramChannels),
  ]);
  const allIds = [...whatsappRows.map((c) => c.id), ...instagramRows.map((c) => c.id)];

  if (role === "admin") return allIds;

  const [whatsappRestrictions, instagramRestrictions] = await Promise.all([
    db
      .select({ channelId: whatsappChannelRestrictions.channelId })
      .from(whatsappChannelRestrictions)
      .where(eq(whatsappChannelRestrictions.userId, userId)),
    db
      .select({ channelId: instagramChannelRestrictions.channelId })
      .from(instagramChannelRestrictions)
      .where(eq(instagramChannelRestrictions.userId, userId)),
  ]);
  const blockedIds = new Set([
    ...whatsappRestrictions.map((r) => r.channelId),
    ...instagramRestrictions.map((r) => r.channelId),
  ]);

  return allIds.filter((id) => !blockedIds.has(id));
}

// Inverso de getAllowedChannelIds: dado um canal, quem tem acesso a ele —
// todo admin, mais todo atendente que não tenha uma linha de restrição pra
// esse canal específico em nenhuma das duas tabelas (ver modelo de bloqueio
// no topo do arquivo).
export async function getUsersWithChannelAccess(channelId: string): Promise<string[]> {
  const [whatsappRestricted, instagramRestricted] = await Promise.all([
    db
      .select({ userId: whatsappChannelRestrictions.userId })
      .from(whatsappChannelRestrictions)
      .where(eq(whatsappChannelRestrictions.channelId, channelId)),
    db
      .select({ userId: instagramChannelRestrictions.userId })
      .from(instagramChannelRestrictions)
      .where(eq(instagramChannelRestrictions.channelId, channelId)),
  ]);
  const restrictedIds = [
    ...whatsappRestricted.map((r) => r.userId),
    ...instagramRestricted.map((r) => r.userId),
  ];

  const allowed = await db
    .select({ id: users.id })
    .from(users)
    .where(restrictedIds.length > 0 ? notInArray(users.id, restrictedIds) : undefined);

  return allowed.map((u) => u.id);
}

// channelId não é FK'd a uma tabela só (ver comentário no topo do arquivo) —
// usado por quem precisa saber pra qual provedor despachar (ex: cron de
// mensagens agendadas, que não guarda channelType na própria linha).
export async function getChannelType(
  channelId: string
): Promise<"whatsapp" | "instagram" | null> {
  const [[whatsapp], [instagram]] = await Promise.all([
    db.select({ id: whatsappChannels.id }).from(whatsappChannels).where(eq(whatsappChannels.id, channelId)).limit(1),
    db.select({ id: instagramChannels.id }).from(instagramChannels).where(eq(instagramChannels.id, channelId)).limit(1),
  ]);
  if (whatsapp) return "whatsapp";
  if (instagram) return "instagram";
  return null;
}

export async function userHasChannelAccess(
  userId: string,
  role: "admin" | "atendente",
  channelId: string
): Promise<boolean> {
  if (role === "admin") return true;

  const [[whatsappRestriction], [instagramRestriction]] = await Promise.all([
    db
      .select({ id: whatsappChannelRestrictions.id })
      .from(whatsappChannelRestrictions)
      .where(
        and(
          eq(whatsappChannelRestrictions.userId, userId),
          eq(whatsappChannelRestrictions.channelId, channelId)
        )
      )
      .limit(1),
    db
      .select({ id: instagramChannelRestrictions.id })
      .from(instagramChannelRestrictions)
      .where(
        and(
          eq(instagramChannelRestrictions.userId, userId),
          eq(instagramChannelRestrictions.channelId, channelId)
        )
      )
      .limit(1),
  ]);

  return !whatsappRestriction && !instagramRestriction;
}

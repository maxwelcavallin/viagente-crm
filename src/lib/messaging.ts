import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { contacts, deals } from "@/db/schema";

// "phone" pode vir mascarado como um id de privacidade do WhatsApp (formato
// "<numero>@lid") em vez do número real — acontece sobretudo em mensagens
// mandadas direto do aparelho conectado, fora do CRM (ver handleIncomingMessage
// no webhook do WhatsApp). Nesses casos "phone" sozinho não é uma identidade
// confiável: o mesmo contato pode aparecer com o número real numa mensagem e
// com um @lid mascarado noutra, o que criava um contato órfão novo a cada
// evento mascarado. whatsappLid (campo "chatLid" da Z-API) é o identificador
// estável recomendado pra esse cenário — ver developer.z-api.io/en/tips/lid.
export async function findOrCreateContactByPhone(
  phone: string,
  name?: string,
  info?: { isGroup?: boolean; avatarUrl?: string; whatsappLid?: string | null }
): Promise<{ id: string }> {
  const whatsappLid = info?.whatsappLid ?? null;

  // Prioriza o lid quando disponível — é a identidade mais estável (ver
  // comentário acima); só cai pro telefone se nenhum contato já tiver esse
  // lid guardado (ex: primeira vez que esse chat aparece, ou telefone real
  // já visto antes sem lid associado ainda).
  const [existing] = whatsappLid
    ? await db
        .select({
          id: contacts.id,
          name: contacts.name,
          avatarUrl: contacts.avatarUrl,
          isGroup: contacts.isGroup,
          phone: contacts.phone,
          whatsappLid: contacts.whatsappLid,
        })
        .from(contacts)
        .where(eq(contacts.whatsappLid, whatsappLid))
        .limit(1)
    : [];

  const [existingByPhone] = !existing
    ? await db
        .select({
          id: contacts.id,
          name: contacts.name,
          avatarUrl: contacts.avatarUrl,
          isGroup: contacts.isGroup,
          phone: contacts.phone,
          whatsappLid: contacts.whatsappLid,
        })
        .from(contacts)
        .where(eq(contacts.phone, phone))
        .limit(1)
    : [];

  const match = existing ?? existingByPhone;

  if (match) {
    // Nome/foto de contatos e grupos do WhatsApp mudam com o tempo — mantém
    // atualizado sem exigir edição manual no CRM.
    const trimmedName = name?.trim();
    const nextName = trimmedName && trimmedName !== match.name ? trimmedName : undefined;
    const nextAvatar =
      info?.avatarUrl && info.avatarUrl !== match.avatarUrl ? info.avatarUrl : undefined;
    const nextIsGroup =
      info?.isGroup !== undefined && info.isGroup !== match.isGroup ? info.isGroup : undefined;
    // Guarda o lid assim que aparece pra esse contato, mesmo que ele já
    // exista via telefone — é o que permite resolver o próximo evento
    // mascarado (só lid, sem telefone real) de volta pra esse mesmo contato.
    const nextLid =
      whatsappLid && whatsappLid !== match.whatsappLid ? whatsappLid : undefined;
    if (nextName || nextAvatar || nextIsGroup !== undefined || nextLid) {
      await db
        .update(contacts)
        .set({
          ...(nextName ? { name: nextName } : {}),
          ...(nextAvatar ? { avatarUrl: nextAvatar } : {}),
          ...(nextIsGroup !== undefined ? { isGroup: nextIsGroup } : {}),
          ...(nextLid ? { whatsappLid: nextLid } : {}),
        })
        .where(eq(contacts.id, match.id));
    }
    return match;
  }

  const [created] = await db
    .insert(contacts)
    .values({
      phone,
      whatsappLid,
      name: name?.trim() || phone,
      isGroup: info?.isGroup ?? false,
      avatarUrl: info?.avatarUrl,
    })
    .returning({ id: contacts.id });

  return created;
}

// Espelha findOrCreateContactByPhone, mas dedupe por instagramUserId (IGSID)
// em vez de telefone — ver Etapa 25.
export async function findOrCreateContactByInstagramUserId(
  instagramUserId: string,
  name?: string,
  avatarUrl?: string,
  username?: string
): Promise<{ id: string }> {
  const [existing] = await db
    .select({
      id: contacts.id,
      name: contacts.name,
      avatarUrl: contacts.avatarUrl,
      instagramUsername: contacts.instagramUsername,
    })
    .from(contacts)
    .where(eq(contacts.instagramUserId, instagramUserId))
    .limit(1);

  if (existing) {
    const trimmedName = name?.trim();
    const nextName = trimmedName && trimmedName !== existing.name ? trimmedName : undefined;
    const nextAvatar = avatarUrl && avatarUrl !== existing.avatarUrl ? avatarUrl : undefined;
    const nextUsername = username && username !== existing.instagramUsername ? username : undefined;
    if (nextName || nextAvatar || nextUsername) {
      await db
        .update(contacts)
        .set({
          ...(nextName ? { name: nextName } : {}),
          ...(nextAvatar ? { avatarUrl: nextAvatar } : {}),
          ...(nextUsername ? { instagramUsername: nextUsername } : {}),
        })
        .where(eq(contacts.id, existing.id));
    }
    return existing;
  }

  const [created] = await db
    .insert(contacts)
    .values({
      instagramUserId,
      name: name?.trim() || instagramUserId,
      avatarUrl,
      instagramUsername: username,
    })
    .returning({ id: contacts.id });

  return created;
}

// Heurística da seção 7 da spec: se o contato tiver mais de um negócio
// aberto, usa o mais recentemente atualizado.
export async function findOpenDealIdForContact(
  contactId: string
): Promise<string | null> {
  const [deal] = await db
    .select({ id: deals.id })
    .from(deals)
    .where(and(eq(deals.contactId, contactId), eq(deals.status, "aberto")))
    .orderBy(desc(deals.updatedAt))
    .limit(1);

  return deal?.id ?? null;
}

import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { contacts, deals } from "@/db/schema";

export async function findOrCreateContactByPhone(
  phone: string,
  name?: string,
  info?: { isGroup?: boolean; avatarUrl?: string }
): Promise<{ id: string }> {
  const [existing] = await db
    .select({
      id: contacts.id,
      name: contacts.name,
      avatarUrl: contacts.avatarUrl,
      isGroup: contacts.isGroup,
    })
    .from(contacts)
    .where(eq(contacts.phone, phone))
    .limit(1);

  if (existing) {
    // Nome/foto de contatos e grupos do WhatsApp mudam com o tempo — mantém
    // atualizado sem exigir edição manual no CRM.
    const trimmedName = name?.trim();
    const nextName = trimmedName && trimmedName !== existing.name ? trimmedName : undefined;
    const nextAvatar =
      info?.avatarUrl && info.avatarUrl !== existing.avatarUrl ? info.avatarUrl : undefined;
    const nextIsGroup =
      info?.isGroup !== undefined && info.isGroup !== existing.isGroup
        ? info.isGroup
        : undefined;
    if (nextName || nextAvatar || nextIsGroup !== undefined) {
      await db
        .update(contacts)
        .set({
          ...(nextName ? { name: nextName } : {}),
          ...(nextAvatar ? { avatarUrl: nextAvatar } : {}),
          ...(nextIsGroup !== undefined ? { isGroup: nextIsGroup } : {}),
        })
        .where(eq(contacts.id, existing.id));
    }
    return existing;
  }

  const [created] = await db
    .insert(contacts)
    .values({
      phone,
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

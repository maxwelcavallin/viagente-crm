import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { contacts, deals } from "@/db/schema";

export async function findOrCreateContactByPhone(
  phone: string,
  name?: string
): Promise<{ id: string }> {
  const [existing] = await db
    .select({ id: contacts.id })
    .from(contacts)
    .where(eq(contacts.phone, phone))
    .limit(1);

  if (existing) return existing;

  const [created] = await db
    .insert(contacts)
    .values({ phone, name: name?.trim() || phone })
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

import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { contactTags, dealTags, tags } from "@/db/schema";
import { fireTagAddedAutomations } from "@/lib/task-automation";

export type TagOption = { id: string; name: string; color: string | null };

export { splitTagNames } from "@/lib/tag-parse";

// Busca tags existentes por nome (case-insensitive) e cria as que não
// existirem ainda — "tags.name" tem índice único, então duas chamadas
// concorrentes tentando criar o mesmo nome apenas uma cria de fato.
export async function resolveOrCreateTagIds(names: string[]): Promise<string[]> {
  const uniqueNames = Array.from(
    new Map(names.map((n) => [n.toLowerCase(), n])).values()
  );
  if (uniqueNames.length === 0) return [];

  const existing = await db.select({ id: tags.id, name: tags.name }).from(tags);
  const byLowerName = new Map(existing.map((t) => [t.name.toLowerCase(), t.id]));

  const toCreate = uniqueNames.filter((n) => !byLowerName.has(n.toLowerCase()));
  if (toCreate.length > 0) {
    const created = await db
      .insert(tags)
      .values(toCreate.map((name) => ({ name })))
      .onConflictDoNothing()
      .returning({ id: tags.id, name: tags.name });
    for (const t of created) byLowerName.set(t.name.toLowerCase(), t.id);

    // Corrida rara: outro processo criou o mesmo nome entre o select e o
    // insert (onConflictDoNothing pulou silenciosamente) — busca de novo.
    const stillMissing = toCreate.filter((n) => !byLowerName.has(n.toLowerCase()));
    if (stillMissing.length > 0) {
      const rows = await db
        .select({ id: tags.id, name: tags.name })
        .from(tags)
        .where(inArray(tags.name, stillMissing));
      for (const t of rows) byLowerName.set(t.name.toLowerCase(), t.id);
    }
  }

  return uniqueNames
    .map((n) => byLowerName.get(n.toLowerCase()))
    .filter((id): id is string => Boolean(id));
}

export async function attachTagsToContact(contactId: string, tagIds: string[]): Promise<void> {
  if (tagIds.length === 0) return;
  await db
    .insert(contactTags)
    .values(tagIds.map((tagId) => ({ contactId, tagId })))
    .onConflictDoNothing();
}

export async function attachTagsToDeal(dealId: string, tagIds: string[]): Promise<void> {
  if (tagIds.length === 0) return;
  // .returning() só traz as linhas que de fato foram inseridas (tags que o
  // negócio ainda não tinha) — usado pra disparar a automação de "tag
  // adicionada" só pras tags genuinamente novas (webhook de entrada e
  // importação de CSV passam por aqui).
  const inserted = await db
    .insert(dealTags)
    .values(tagIds.map((tagId) => ({ dealId, tagId })))
    .onConflictDoNothing()
    .returning({ tagId: dealTags.tagId });

  await fireTagAddedAutomations(
    dealId,
    inserted.map((row) => row.tagId)
  );
}

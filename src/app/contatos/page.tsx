import { and, asc, count, desc, eq, gte, ilike, inArray, isNotNull, isNull, lte, or, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/db";
import { contactTags, contacts, customFieldDefinitions, tags, users } from "@/db/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ContactsTable, type ContactRow } from "./contacts-table";
import { ContactsFilters, OWNER_MINE, OWNER_UNASSIGNED } from "./contacts-filters";
import { ContactsPagination } from "./contacts-pagination";
import type { FieldDef, TagOption } from "./contact-form-dialog";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export default async function ContatosPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    q?: string;
    from?: string;
    to?: string;
    tag?: string;
    owner?: string;
    dup?: string;
  }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);

  // Grupos com telefone/email repetido — leve (só id+nome agregados por
  // GROUP BY, não a linha inteira de cada contato) e sempre calculado
  // inteiro, independente de página/filtro: o aviso de duplicata numa linha
  // da página atual pode apontar pra um contato em outra página.
  const [dupPhoneGroups, dupEmailGroups] = await Promise.all([
    db
      .select({
        ids: sql<string[]>`array_agg(${contacts.id})`,
        names: sql<string[]>`array_agg(${contacts.name})`,
      })
      .from(contacts)
      .where(isNotNull(contacts.phone))
      .groupBy(contacts.phone)
      .having(sql`count(*) > 1`),
    db
      .select({
        ids: sql<string[]>`array_agg(${contacts.id})`,
        names: sql<string[]>`array_agg(${contacts.name})`,
      })
      .from(contacts)
      .where(isNotNull(contacts.email))
      .groupBy(contacts.email)
      .having(sql`count(*) > 1`),
  ]);
  const duplicateNameByContact = new Map<string, string>();
  for (const group of [...dupPhoneGroups, ...dupEmailGroups]) {
    for (let i = 0; i < group.ids.length; i++) {
      if (duplicateNameByContact.has(group.ids[i])) continue;
      const otherIdx = i === 0 ? 1 : 0;
      duplicateNameByContact.set(group.ids[i], group.names[otherIdx]);
    }
  }

  const conditions = [];

  if (params.q?.trim()) {
    const pattern = `%${params.q.trim()}%`;
    conditions.push(
      or(
        ilike(contacts.name, pattern),
        ilike(contacts.phone, pattern),
        ilike(contacts.email, pattern)
      )
    );
  }
  if (params.from) conditions.push(gte(contacts.createdAt, new Date(params.from)));
  if (params.to) {
    const to = new Date(params.to);
    to.setHours(23, 59, 59, 999);
    conditions.push(lte(contacts.createdAt, to));
  }
  if (params.tag) {
    const tagged = await db
      .select({ contactId: contactTags.contactId })
      .from(contactTags)
      .where(eq(contactTags.tagId, params.tag));
    conditions.push(inArray(contacts.id, tagged.map((t) => t.contactId)));
  }
  if (params.owner === OWNER_MINE) {
    conditions.push(eq(contacts.ownerId, session.user.id));
  } else if (params.owner === OWNER_UNASSIGNED) {
    conditions.push(isNull(contacts.ownerId));
  } else if (params.owner) {
    conditions.push(eq(contacts.ownerId, params.owner));
  }
  if (params.dup === "1") {
    conditions.push(inArray(contacts.id, [...duplicateNameByContact.keys()]));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [fieldDefRows, tagRows, ownerRows, [{ total }], contactRows] = await Promise.all([
    db
      .select()
      .from(customFieldDefinitions)
      .where(eq(customFieldDefinitions.entity, "contact"))
      .orderBy(asc(customFieldDefinitions.order)),
    db.select().from(tags).orderBy(tags.name),
    db.select({ id: users.id, name: users.name }).from(users).orderBy(asc(users.name)),
    db.select({ total: count() }).from(contacts).where(where),
    db
      .select()
      .from(contacts)
      .where(where)
      .orderBy(desc(contacts.createdAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
  ]);

  const fieldDefinitions: FieldDef[] = fieldDefRows.map((row) => ({
    id: row.id,
    key: row.key,
    label: row.label,
    type: row.type,
    options: (row.options as { value: string; label: string }[] | null) ?? null,
  }));

  const allTags: TagOption[] = tagRows.map((tag) => ({
    id: tag.id,
    name: tag.name,
    color: tag.color,
  }));
  const tagById = new Map(allTags.map((tag) => [tag.id, tag]));

  const pageContactIds = contactRows.map((c) => c.id);
  const contactTagRows =
    pageContactIds.length > 0
      ? await db
          .select({ contactId: contactTags.contactId, tagId: contactTags.tagId })
          .from(contactTags)
          .where(inArray(contactTags.contactId, pageContactIds))
      : [];
  const tagIdsByContact = new Map<string, string[]>();
  for (const row of contactTagRows) {
    const list = tagIdsByContact.get(row.contactId) ?? [];
    list.push(row.tagId);
    tagIdsByContact.set(row.contactId, list);
  }

  const rows: ContactRow[] = contactRows.map((contact) => {
    const tagIds = tagIdsByContact.get(contact.id) ?? [];
    return {
      id: contact.id,
      name: contact.name,
      phone: contact.phone,
      email: contact.email,
      customFields: (contact.customFields as Record<string, unknown>) ?? {},
      tagIds,
      duplicateName: duplicateNameByContact.get(contact.id) ?? null,
      tags: tagIds
        .map((id) => tagById.get(id))
        .filter((tag): tag is TagOption => Boolean(tag)),
    };
  });

  const visibleFieldDefs = fieldDefinitions.slice(0, 3);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasAnyFilter = Boolean(
    params.q || params.from || params.to || params.tag || params.owner || params.dup
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Contatos</h1>
      <Card>
        <CardHeader>
          <CardTitle>Contatos cadastrados</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ContactsFilters allTags={allTags} owners={ownerRows} currentUserId={session.user.id} />
          <ContactsTable
            contacts={rows}
            fieldDefinitions={fieldDefinitions}
            visibleFieldDefs={visibleFieldDefs}
            allTags={allTags}
            hasAnyFilter={hasAnyFilter}
          />
          <ContactsPagination page={page} totalPages={totalPages} total={total} pageSize={PAGE_SIZE} />
        </CardContent>
      </Card>
    </div>
  );
}

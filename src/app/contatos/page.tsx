import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { contactTags, contacts, customFieldDefinitions, tags } from "@/db/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ContactsTable, type ContactRow } from "./contacts-table";
import type { FieldDef, TagOption } from "./contact-form-dialog";

export const dynamic = "force-dynamic";

export default async function ContatosPage() {
  const [fieldDefRows, tagRows, contactRows, contactTagRows] = await Promise.all([
    db
      .select()
      .from(customFieldDefinitions)
      .where(eq(customFieldDefinitions.entity, "contact"))
      .orderBy(asc(customFieldDefinitions.order)),
    db.select().from(tags).orderBy(tags.name),
    db.select().from(contacts).orderBy(desc(contacts.createdAt)),
    db
      .select({ contactId: contactTags.contactId, tagId: contactTags.tagId })
      .from(contactTags),
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
      tags: tagIds
        .map((id) => tagById.get(id))
        .filter((tag): tag is TagOption => Boolean(tag)),
    };
  });

  const visibleFieldDefs = fieldDefinitions.slice(0, 3);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Contatos</h1>
      <Card>
        <CardHeader>
          <CardTitle>Contatos cadastrados</CardTitle>
        </CardHeader>
        <CardContent>
          <ContactsTable
            contacts={rows}
            fieldDefinitions={fieldDefinitions}
            visibleFieldDefs={visibleFieldDefs}
            allTags={allTags}
          />
        </CardContent>
      </Card>
    </div>
  );
}

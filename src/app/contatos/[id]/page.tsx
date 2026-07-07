import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/auth";
import { db } from "@/db";
import { contactTags, contacts, customFieldDefinitions, tags } from "@/db/schema";
import { getAllowedChannelIds } from "@/lib/channel-access";
import { getThread } from "@/lib/conversations";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageList } from "@/components/message-list";
import { ContactFormDialog, type FieldDef, type TagOption } from "../contact-form-dialog";
import { DeleteContactDialog } from "../delete-contact-dialog";
import { formatCustomFieldValue } from "../custom-field-format";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function ContatoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await params;

  const [contact] = await db
    .select()
    .from(contacts)
    .where(eq(contacts.id, id))
    .limit(1);
  if (!contact) notFound();

  const [fieldDefRows, allTagRows, contactTagRows, allowedChannelIds] =
    await Promise.all([
      db
        .select()
        .from(customFieldDefinitions)
        .where(eq(customFieldDefinitions.entity, "contact"))
        .orderBy(asc(customFieldDefinitions.order)),
      db.select().from(tags).orderBy(tags.name),
      db
        .select({ tagId: contactTags.tagId })
        .from(contactTags)
        .where(eq(contactTags.contactId, id)),
      getAllowedChannelIds(session.user.id, session.user.role),
    ]);

  const thread = await getThread(id, allowedChannelIds);

  const fieldDefinitions: FieldDef[] = fieldDefRows.map((row) => ({
    id: row.id,
    key: row.key,
    label: row.label,
    type: row.type,
    options: (row.options as { value: string; label: string }[] | null) ?? null,
  }));

  const allTags: TagOption[] = allTagRows.map((tag) => ({
    id: tag.id,
    name: tag.name,
    color: tag.color,
  }));
  const tagById = new Map(allTags.map((tag) => [tag.id, tag]));
  const contactTagIds = contactTagRows.map((row) => row.tagId);
  const contactTagsList = contactTagIds
    .map((tagId) => tagById.get(tagId))
    .filter((tag): tag is TagOption => Boolean(tag));

  const customFields = (contact.customFields as Record<string, unknown>) ?? {};

  return (
    <div className="space-y-6">
      <Link
        href="/contatos"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft size={16} strokeWidth={1.75} />
        Contatos
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">{contact.name}</h1>
          <p className="text-sm text-muted-foreground">{contact.phone}</p>
          {contact.email && (
            <p className="text-sm text-muted-foreground">{contact.email}</p>
          )}
          {contactTagsList.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {contactTagsList.map((tag) => (
                <Badge key={tag.id} variant="secondary" dot>
                  {tag.name}
                </Badge>
              ))}
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <ContactFormDialog
            mode="edit"
            contact={{
              id: contact.id,
              name: contact.name,
              phone: contact.phone,
              email: contact.email,
              customFields,
              tagIds: contactTagIds,
            }}
            fieldDefinitions={fieldDefinitions}
            allTags={allTags}
            trigger={<Button type="button" variant="outline" />}
            triggerLabel="Editar"
          />
          <DeleteContactDialog contact={contact} redirectTo="/contatos" />
        </div>
      </div>

      {fieldDefinitions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Campos customizados</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {fieldDefinitions.map((field) => (
                <div key={field.id} className="space-y-0.5">
                  <dt className="text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
                    {field.label}
                  </dt>
                  <dd className="text-sm">
                    {formatCustomFieldValue(field, customFields[field.key])}
                  </dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Histórico de conversa</CardTitle>
          <a
            href={`/api/conversations/${contact.id}/export`}
            className="text-sm text-primary hover:underline"
          >
            Exportar conversa (.md)
          </a>
        </CardHeader>
        <CardContent>
          <MessageList
            messages={thread}
            emptyMessage="Nenhuma conversa registrada com este contato ainda."
          />
        </CardContent>
      </Card>
    </div>
  );
}

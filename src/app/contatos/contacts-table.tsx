"use client";

import Link from "next/link";
import { Plus, Search, TriangleAlert, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DeleteContactDialog } from "./delete-contact-dialog";
import { formatCustomFieldValue } from "./custom-field-format";
import {
  ContactFormDialog,
  type ContactData,
  type FieldDef,
  type TagOption,
} from "./contact-form-dialog";

export type ContactRow = ContactData & {
  tags: TagOption[];
  duplicateName: string | null;
};

export function ContactsTable({
  contacts,
  fieldDefinitions,
  visibleFieldDefs,
  allTags,
  hasAnyFilter,
}: {
  contacts: ContactRow[];
  fieldDefinitions: FieldDef[];
  visibleFieldDefs: FieldDef[];
  allTags: TagOption[];
  // Busca/filtros agora rodam no servidor (ver page.tsx) — só pra escolher
  // a mensagem certa quando a página atual vem vazia (filtro sem resultado
  // vs. nenhum contato cadastrado ainda).
  hasAnyFilter: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <ContactFormDialog
          mode="create"
          fieldDefinitions={fieldDefinitions}
          allTags={allTags}
          trigger={<Button type="button" />}
          triggerLabel={
            <>
              <Plus size={16} strokeWidth={1.75} />
              Novo contato
            </>
          }
        />
      </div>

      {contacts.length === 0 ? (
        hasAnyFilter ? (
          <EmptyState
            icon={Search}
            title="Nenhum contato encontrado"
            description="Tente ajustar a busca ou os filtros acima."
          />
        ) : (
          <EmptyState
            icon={Users}
            title="Nenhum contato cadastrado"
            description="Crie o primeiro contato pelo botão acima."
          />
        )
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Tags</TableHead>
              {visibleFieldDefs.map((field) => (
                <TableHead key={field.id}>{field.label}</TableHead>
              ))}
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {contacts.map((contact) => (
              <TableRow key={contact.id}>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    <Link
                      href={`/contatos/${contact.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {contact.name}
                    </Link>
                    {contact.duplicateName && (
                      <TriangleAlert
                        size={14}
                        strokeWidth={1.75}
                        className="shrink-0 text-status-warning"
                        aria-label={`Possível duplicata de ${contact.duplicateName}`}
                      >
                        <title>{`Possível duplicata de ${contact.duplicateName}`}</title>
                      </TriangleAlert>
                    )}
                  </div>
                </TableCell>
                <TableCell>{contact.phone ?? "—"}</TableCell>
                <TableCell>{contact.email ?? "—"}</TableCell>
                <TableCell>
                  {contact.tags.length === 0 ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {contact.tags.map((tag) => (
                        <Badge key={tag.id} variant="secondary" dot>
                          {tag.name}
                        </Badge>
                      ))}
                    </div>
                  )}
                </TableCell>
                {visibleFieldDefs.map((field) => (
                  <TableCell key={field.id}>
                    {formatCustomFieldValue(field, contact.customFields?.[field.key])}
                  </TableCell>
                ))}
                <TableCell>
                  <div className="flex items-center justify-end gap-2">
                    <ContactFormDialog
                      mode="edit"
                      contact={contact}
                      fieldDefinitions={fieldDefinitions}
                      allTags={allTags}
                      trigger={<Button type="button" variant="outline" size="sm" />}
                      triggerLabel="Editar"
                    />
                    <DeleteContactDialog contact={contact} />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

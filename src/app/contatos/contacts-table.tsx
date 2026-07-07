"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Search, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
};

function matchesSearch(contact: ContactRow, term: string): boolean {
  if (!term) return true;
  const normalized = term.toLowerCase();
  return (
    contact.name.toLowerCase().includes(normalized) ||
    contact.phone.toLowerCase().includes(normalized) ||
    (contact.email ?? "").toLowerCase().includes(normalized)
  );
}

export function ContactsTable({
  contacts,
  fieldDefinitions,
  visibleFieldDefs,
  allTags,
}: {
  contacts: ContactRow[];
  fieldDefinitions: FieldDef[];
  visibleFieldDefs: FieldDef[];
  allTags: TagOption[];
}) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(
    () => contacts.filter((c) => matchesSearch(c, search)),
    [contacts, search]
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-sm">
          <Search
            size={16}
            strokeWidth={1.75}
            className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, telefone ou email..."
            className="h-9 pl-8"
          />
        </div>
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
        <EmptyState
          icon={Users}
          title="Nenhum contato cadastrado"
          description="Crie o primeiro contato pelo botão acima."
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Search}
          title="Nenhum contato encontrado"
          description="Tente buscar por outro nome, telefone ou email."
        />
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
            {filtered.map((contact) => (
              <TableRow key={contact.id}>
                <TableCell>
                  <Link
                    href={`/contatos/${contact.id}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {contact.name}
                  </Link>
                </TableCell>
                <TableCell>{contact.phone}</TableCell>
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

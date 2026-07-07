"use server";

import { and, count, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/db";
import {
  contactTags,
  contacts,
  customFieldDefinitions,
  deals,
  messages,
} from "@/db/schema";

async function requireSession() {
  const session = await auth();
  return session?.user ?? null;
}

export type ContactFormState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; contactId: string };

async function buildCustomFields(
  formData: FormData
): Promise<Record<string, string>> {
  const definitions = await db
    .select({ key: customFieldDefinitions.key })
    .from(customFieldDefinitions)
    .where(eq(customFieldDefinitions.entity, "contact"));

  const customFields: Record<string, string> = {};
  for (const def of definitions) {
    const value = formData.get(`custom_${def.key}`);
    if (typeof value === "string" && value.trim()) {
      customFields[def.key] = value.trim();
    }
  }
  return customFields;
}

async function phoneConflicts(phone: string, excludeId?: string) {
  const [existing] = await db
    .select({ id: contacts.id })
    .from(contacts)
    .where(
      excludeId
        ? and(eq(contacts.phone, phone), ne(contacts.id, excludeId))
        : eq(contacts.phone, phone)
    )
    .limit(1);
  return Boolean(existing);
}

async function syncTags(contactId: string, tagIds: string[]) {
  const uniqueTagIds = Array.from(new Set(tagIds));
  const inserts = uniqueTagIds.map((tagId) =>
    db.insert(contactTags).values({ contactId, tagId })
  );
  const del = db.delete(contactTags).where(eq(contactTags.contactId, contactId));

  if (inserts.length === 0) {
    await del;
    return;
  }
  await db.batch([
    del,
    ...(inserts as [(typeof inserts)[number], ...(typeof inserts)[number][]]),
  ]);
}

export async function createContactAction(
  _prevState: ContactFormState,
  formData: FormData
): Promise<ContactFormState> {
  const user = await requireSession();
  if (!user) return { status: "error", message: "Acesso negado." };

  const name = formData.get("name");
  const phone = formData.get("phone");
  const email = formData.get("email");
  const tagIds = formData.getAll("tagIds").filter((v): v is string => typeof v === "string");

  if (typeof name !== "string" || !name.trim()) {
    return { status: "error", message: "Nome é obrigatório." };
  }
  if (typeof phone !== "string" || !phone.trim()) {
    return { status: "error", message: "Telefone é obrigatório." };
  }

  const normalizedPhone = phone.trim();
  if (await phoneConflicts(normalizedPhone)) {
    return {
      status: "error",
      message: "Já existe um contato com esse telefone.",
    };
  }

  const customFields = await buildCustomFields(formData);

  const [created] = await db
    .insert(contacts)
    .values({
      name: name.trim(),
      phone: normalizedPhone,
      email: typeof email === "string" && email.trim() ? email.trim() : null,
      customFields,
    })
    .returning({ id: contacts.id });

  await syncTags(created.id, tagIds);

  revalidatePath("/contatos");
  return { status: "success", contactId: created.id };
}

export async function updateContactAction(
  _prevState: ContactFormState,
  formData: FormData
): Promise<ContactFormState> {
  const user = await requireSession();
  if (!user) return { status: "error", message: "Acesso negado." };

  const id = formData.get("id");
  const name = formData.get("name");
  const phone = formData.get("phone");
  const email = formData.get("email");
  const tagIds = formData.getAll("tagIds").filter((v): v is string => typeof v === "string");

  if (typeof id !== "string" || !id) {
    return { status: "error", message: "Contato inválido." };
  }
  if (typeof name !== "string" || !name.trim()) {
    return { status: "error", message: "Nome é obrigatório." };
  }
  if (typeof phone !== "string" || !phone.trim()) {
    return { status: "error", message: "Telefone é obrigatório." };
  }

  const normalizedPhone = phone.trim();
  if (await phoneConflicts(normalizedPhone, id)) {
    return {
      status: "error",
      message: "Já existe um contato com esse telefone.",
    };
  }

  const customFields = await buildCustomFields(formData);

  await db
    .update(contacts)
    .set({
      name: name.trim(),
      phone: normalizedPhone,
      email: typeof email === "string" && email.trim() ? email.trim() : null,
      customFields,
    })
    .where(eq(contacts.id, id));

  await syncTags(id, tagIds);

  revalidatePath("/contatos");
  revalidatePath(`/contatos/${id}`);
  return { status: "success", contactId: id };
}

export type DeleteContactState =
  | { status: "idle" }
  | { status: "error"; message: string };

const deleteIdle: DeleteContactState = { status: "idle" };

export async function deleteContactAction(
  _prevState: DeleteContactState,
  formData: FormData
): Promise<DeleteContactState> {
  const user = await requireSession();
  if (!user) return { status: "error", message: "Acesso negado." };

  const id = formData.get("id");
  const redirectTo = formData.get("redirectTo");
  if (typeof id !== "string" || !id) {
    return { status: "error", message: "Contato inválido." };
  }

  const [{ dealCount }] = await db
    .select({ dealCount: count(deals.id) })
    .from(deals)
    .where(eq(deals.contactId, id));

  if (dealCount > 0) {
    return {
      status: "error",
      message: `Não é possível excluir: ${dealCount} negócio(s) estão vinculados a este contato. Mova ou exclua os negócios antes.`,
    };
  }

  await db.delete(contacts).where(eq(contacts.id, id));

  revalidatePath("/contatos");
  if (typeof redirectTo === "string" && redirectTo) {
    redirect(redirectTo);
  }
  return deleteIdle;
}

export async function countContactMessages(contactId: string): Promise<number> {
  const [{ cnt }] = await db
    .select({ cnt: count(messages.id) })
    .from(messages)
    .where(eq(messages.contactId, contactId));
  return cnt;
}

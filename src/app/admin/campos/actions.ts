"use server";

import { asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/db";
import { customFieldDefinitions } from "@/db/schema";

async function requireAdmin() {
  const session = await auth();
  return session?.user?.role === "admin";
}

export type FieldFormState =
  | { status: "idle" }
  | { status: "error"; message: string };

const idle: FieldFormState = { status: "idle" };

const KEY_PATTERN = /^[a-z][a-z0-9_]*$/;

type FieldOption = { value: string; label: string };

function parseOptions(raw: FormDataEntryValue | null): FieldOption[] | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const options = parsed.filter(
      (o): o is FieldOption =>
        o &&
        typeof o.value === "string" &&
        o.value.trim() &&
        typeof o.label === "string" &&
        o.label.trim()
    );
    return options.length > 0 ? options : null;
  } catch {
    return null;
  }
}

export async function createFieldAction(
  _prevState: FieldFormState,
  formData: FormData
): Promise<FieldFormState> {
  if (!(await requireAdmin())) {
    return { status: "error", message: "Acesso negado." };
  }

  const entity = formData.get("entity");
  const label = formData.get("label");
  const key = formData.get("key");
  const type = formData.get("type");
  const optionsRaw = formData.get("options");

  if (entity !== "contact" && entity !== "deal") {
    return { status: "error", message: "Entidade inválida." };
  }
  if (typeof label !== "string" || !label.trim()) {
    return { status: "error", message: "Label é obrigatório." };
  }
  if (typeof key !== "string" || !KEY_PATTERN.test(key.trim())) {
    return {
      status: "error",
      message:
        "Chave inválida — use apenas letras minúsculas, números e underscore, começando com uma letra.",
    };
  }
  if (
    type !== "texto" &&
    type !== "numero" &&
    type !== "select" &&
    type !== "data"
  ) {
    return { status: "error", message: "Tipo inválido." };
  }

  const normalizedKey = key.trim();

  const rowsForEntity = await db
    .select({ id: customFieldDefinitions.id, key: customFieldDefinitions.key, order: customFieldDefinitions.order })
    .from(customFieldDefinitions)
    .where(eq(customFieldDefinitions.entity, entity));

  if (rowsForEntity.some((r) => r.key === normalizedKey)) {
    return {
      status: "error",
      message: "Já existe um campo com essa chave nesta entidade.",
    };
  }

  let options: FieldOption[] | null = null;
  if (type === "select") {
    options = parseOptions(optionsRaw);
    if (!options) {
      return {
        status: "error",
        message: "Campo do tipo select precisa de pelo menos uma opção.",
      };
    }
  }

  const nextOrder =
    rowsForEntity.length > 0
      ? Math.max(...rowsForEntity.map((r) => r.order)) + 1
      : 0;

  await db.insert(customFieldDefinitions).values({
    entity,
    key: normalizedKey,
    label: label.trim(),
    type,
    options,
    order: nextOrder,
  });

  revalidatePath("/admin/campos");
  return idle;
}

export async function updateFieldAction(
  _prevState: FieldFormState,
  formData: FormData
): Promise<FieldFormState> {
  if (!(await requireAdmin())) {
    return { status: "error", message: "Acesso negado." };
  }

  const id = formData.get("id");
  const label = formData.get("label");
  const optionsRaw = formData.get("options");

  if (typeof id !== "string" || !id) {
    return { status: "error", message: "Campo inválido." };
  }
  if (typeof label !== "string" || !label.trim()) {
    return { status: "error", message: "Label é obrigatório." };
  }

  const [field] = await db
    .select({ type: customFieldDefinitions.type })
    .from(customFieldDefinitions)
    .where(eq(customFieldDefinitions.id, id))
    .limit(1);
  if (!field) {
    return { status: "error", message: "Campo não encontrado." };
  }

  let options: FieldOption[] | null = null;
  if (field.type === "select") {
    options = parseOptions(optionsRaw);
    if (!options) {
      return {
        status: "error",
        message: "Campo do tipo select precisa de pelo menos uma opção.",
      };
    }
  }

  await db
    .update(customFieldDefinitions)
    .set({ label: label.trim(), options })
    .where(eq(customFieldDefinitions.id, id));

  revalidatePath("/admin/campos");
  return idle;
}

export async function deleteFieldAction(
  _prevState: FieldFormState,
  formData: FormData
): Promise<FieldFormState> {
  if (!(await requireAdmin())) {
    return { status: "error", message: "Acesso negado." };
  }

  const id = formData.get("id");
  if (typeof id !== "string" || !id) {
    return { status: "error", message: "Campo inválido." };
  }

  await db.delete(customFieldDefinitions).where(eq(customFieldDefinitions.id, id));

  revalidatePath("/admin/campos");
  return idle;
}

export async function moveFieldAction(formData: FormData): Promise<void> {
  if (!(await requireAdmin())) return;

  const id = formData.get("id");
  const entity = formData.get("entity");
  const direction = formData.get("direction");
  if (
    typeof id !== "string" ||
    (entity !== "contact" && entity !== "deal") ||
    (direction !== "up" && direction !== "down")
  ) {
    return;
  }

  const rows = await db
    .select({ id: customFieldDefinitions.id, order: customFieldDefinitions.order })
    .from(customFieldDefinitions)
    .where(eq(customFieldDefinitions.entity, entity))
    .orderBy(asc(customFieldDefinitions.order));

  const index = rows.findIndex((r) => r.id === id);
  const neighborIndex = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || neighborIndex < 0 || neighborIndex >= rows.length) return;

  const current = rows[index];
  const neighbor = rows[neighborIndex];

  await db.batch([
    db
      .update(customFieldDefinitions)
      .set({ order: neighbor.order })
      .where(eq(customFieldDefinitions.id, current.id)),
    db
      .update(customFieldDefinitions)
      .set({ order: current.order })
      .where(eq(customFieldDefinitions.id, neighbor.id)),
  ]);

  revalidatePath("/admin/campos");
}

export async function reorderFieldsAction(
  entity: "contact" | "deal",
  orderedIds: string[]
): Promise<{ ok: boolean }> {
  if (!(await requireAdmin())) return { ok: false };
  if (orderedIds.length === 0) return { ok: true };

  const updates = orderedIds.map((id, index) =>
    db
      .update(customFieldDefinitions)
      .set({ order: index })
      .where(eq(customFieldDefinitions.id, id))
  );
  await db.batch(
    updates as [(typeof updates)[number], ...(typeof updates)[number][]]
  );

  revalidatePath("/admin/campos");
  return { ok: true };
}

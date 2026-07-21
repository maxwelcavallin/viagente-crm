"use server";

import { asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/db";
import { temperatureRules } from "@/db/schema";

async function requireAdmin() {
  const session = await auth();
  return session?.user?.role === "admin";
}

export type TemperatureRuleFormState =
  | { status: "idle" }
  | { status: "error"; message: string };

const idle: TemperatureRuleFormState = { status: "idle" };

type ConditionItem = { field: string; op: string; value: string };
type ConditionInput =
  | { all: ConditionItem[] }
  | { any: ConditionItem[] }
  | { default: true };

const VALID_OPS = new Set(["=", "!=", ">", ">=", "<", "<="]);

function parseConditions(raw: FormDataEntryValue | null): ConditionInput | { error: string } {
  if (typeof raw !== "string" || !raw) return { error: "Condições inválidas." };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { error: "Condições inválidas." };
  }
  if (!parsed || typeof parsed !== "object") return { error: "Condições inválidas." };
  const obj = parsed as Record<string, unknown>;
  if (obj.default === true) return { default: true };

  const key = "all" in obj ? "all" : "any" in obj ? "any" : null;
  if (!key) return { error: "Condições inválidas." };
  const items = obj[key];
  if (!Array.isArray(items) || items.length === 0) {
    return { error: "Adicione ao menos uma condição, ou marque a regra como padrão." };
  }
  for (const item of items) {
    if (
      !item ||
      typeof item !== "object" ||
      typeof (item as ConditionItem).field !== "string" ||
      !(item as ConditionItem).field.trim() ||
      !VALID_OPS.has((item as ConditionItem).op) ||
      typeof (item as ConditionItem).value !== "string" ||
      !(item as ConditionItem).value.trim()
    ) {
      return { error: "Toda condição precisa de campo, operador e valor." };
    }
  }
  return key === "all" ? { all: items as ConditionItem[] } : { any: items as ConditionItem[] };
}

type CommonFields = {
  name: string;
  result: "quente" | "morno" | "frio";
  conditions: ConditionInput;
};

function readCommonFields(formData: FormData): CommonFields | { error: string } {
  const name = formData.get("name");
  const result = formData.get("result");
  if (typeof name !== "string" || !name.trim()) return { error: "Nome é obrigatório." };
  if (result !== "quente" && result !== "morno" && result !== "frio") {
    return { error: "Selecione a temperatura resultante." };
  }
  const conditions = parseConditions(formData.get("conditions"));
  if ("error" in conditions) return conditions;

  return { name: name.trim(), result, conditions };
}

export async function createTemperatureRuleAction(
  _prevState: TemperatureRuleFormState,
  formData: FormData
): Promise<TemperatureRuleFormState> {
  if (!(await requireAdmin())) return { status: "error", message: "Acesso negado." };

  const fields = readCommonFields(formData);
  if ("error" in fields) return { status: "error", message: fields.error };

  const rows = await db
    .select({ id: temperatureRules.id, conditions: temperatureRules.conditions })
    .from(temperatureRules)
    .orderBy(asc(temperatureRules.priority));

  // Uma regra "padrão" (conditions.default) sempre bate — se a regra nova
  // entrasse depois dela (comportamento anterior: sempre no fim da lista),
  // nunca seria avaliada de verdade. Toda regra nova que não seja ela mesma
  // "padrão" entra logo antes da primeira regra padrão já existente.
  const isNewDefault = "default" in fields.conditions;
  const firstDefaultIndex = rows.findIndex((r) => {
    const c = r.conditions as { default?: boolean } | null;
    return c?.default === true;
  });
  const insertAt = !isNewDefault && firstDefaultIndex !== -1 ? firstDefaultIndex : rows.length;

  const [created] = await db
    .insert(temperatureRules)
    .values({
      name: fields.name,
      result: fields.result,
      conditions: fields.conditions,
      priority: insertAt,
    })
    .returning({ id: temperatureRules.id });

  const finalOrder = rows.map((r) => r.id);
  finalOrder.splice(insertAt, 0, created.id);
  const updates = finalOrder.map((id, index) =>
    db.update(temperatureRules).set({ priority: index }).where(eq(temperatureRules.id, id))
  );
  await db.batch(updates as [(typeof updates)[number], ...(typeof updates)[number][]]);

  revalidatePath("/configuracoes/temperatura");
  return idle;
}

export async function updateTemperatureRuleAction(
  _prevState: TemperatureRuleFormState,
  formData: FormData
): Promise<TemperatureRuleFormState> {
  if (!(await requireAdmin())) return { status: "error", message: "Acesso negado." };

  const id = formData.get("id");
  if (typeof id !== "string" || !id) return { status: "error", message: "Regra inválida." };

  const fields = readCommonFields(formData);
  if ("error" in fields) return { status: "error", message: fields.error };

  await db
    .update(temperatureRules)
    .set({ name: fields.name, result: fields.result, conditions: fields.conditions })
    .where(eq(temperatureRules.id, id));

  revalidatePath("/configuracoes/temperatura");
  return idle;
}

export async function deleteTemperatureRuleAction(
  _prevState: TemperatureRuleFormState,
  formData: FormData
): Promise<TemperatureRuleFormState> {
  if (!(await requireAdmin())) return { status: "error", message: "Acesso negado." };

  const id = formData.get("id");
  if (typeof id !== "string" || !id) return { status: "error", message: "Regra inválida." };

  await db.delete(temperatureRules).where(eq(temperatureRules.id, id));

  revalidatePath("/configuracoes/temperatura");
  return idle;
}

export async function reorderTemperatureRulesAction(
  orderedIds: string[]
): Promise<{ ok: boolean }> {
  if (!(await requireAdmin())) return { ok: false };
  if (orderedIds.length === 0) return { ok: true };

  const updates = orderedIds.map((id, index) =>
    db.update(temperatureRules).set({ priority: index }).where(eq(temperatureRules.id, id))
  );
  await db.batch(updates as [(typeof updates)[number], ...(typeof updates)[number][]]);

  revalidatePath("/configuracoes/temperatura");
  return { ok: true };
}

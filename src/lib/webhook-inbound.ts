import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  contacts,
  customFieldDefinitions,
  deals,
  temperatureRules,
  webhookLogs,
} from "@/db/schema";

// Resolve um caminho tipo "answers.gasto_cartao" ou "payload.nome" dentro de
// um objeto JSON arbitrário recebido de fora. Suporta apenas notação de
// ponto (suficiente pros exemplos da spec) — índice de array não é
// necessário pros payloads de formulário (Calculadora/Diagnóstico).
export function getByPath(source: unknown, path: string): unknown {
  const parts = path.split(".").filter(Boolean);
  let current: unknown = source;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

export type FieldMapping = Record<string, string>;

type TemperatureCondition =
  | { all: { field: string; op: string; value: unknown }[] }
  | { any: { field: string; op: string; value: unknown }[] }
  | { default: true };

function compare(actual: unknown, op: string, expected: unknown): boolean {
  const numActual = Number(actual);
  const numExpected = Number(expected);
  const bothNumeric = !Number.isNaN(numActual) && !Number.isNaN(numExpected);

  switch (op) {
    case "=":
    case "==":
      return bothNumeric ? numActual === numExpected : actual === expected;
    case "!=":
      return bothNumeric ? numActual !== numExpected : actual !== expected;
    case ">":
      return bothNumeric && numActual > numExpected;
    case ">=":
      return bothNumeric && numActual >= numExpected;
    case "<":
      return bothNumeric && numActual < numExpected;
    case "<=":
      return bothNumeric && numActual <= numExpected;
    default:
      return false;
  }
}

function conditionMatches(
  condition: TemperatureCondition,
  values: Record<string, unknown>
): boolean {
  if ("default" in condition) return true;
  if ("all" in condition) {
    return condition.all.every((c) => compare(values[c.field], c.op, c.value));
  }
  if ("any" in condition) {
    return condition.any.some((c) => compare(values[c.field], c.op, c.value));
  }
  return false;
}

export async function evaluateTemperature(
  dealCustomFields: Record<string, unknown>
): Promise<"quente" | "morno" | "frio" | null> {
  const rules = await db
    .select()
    .from(temperatureRules)
    .orderBy(temperatureRules.priority);

  for (const rule of rules) {
    if (conditionMatches(rule.conditions as TemperatureCondition, dealCustomFields)) {
      return rule.result;
    }
  }
  return null;
}

export type InboundProcessResult =
  | {
      ok: true;
      contactId: string;
      dealId: string;
      temperature: "quente" | "morno" | "frio" | null;
      missingFields: string[];
    }
  | { ok: false; error: string; missingFields: string[] };

export async function processInboundPayload(
  webhookConfig: {
    id: string;
    fieldMapping: unknown;
    defaultPipelineId: string | null;
    defaultStageId: string | null;
  },
  payload: unknown
): Promise<InboundProcessResult> {
  const fieldMapping = (webhookConfig.fieldMapping as FieldMapping) ?? {};

  if (!webhookConfig.defaultPipelineId || !webhookConfig.defaultStageId) {
    return {
      ok: false,
      error: "Webhook sem pipeline/etapa padrão configurada.",
      missingFields: [],
    };
  }

  const missingFields: string[] = [];
  const contactFields: { name?: string; phone?: string; email?: string } = {};
  const contactCustomFields: Record<string, string> = {};
  const dealCustomFields: Record<string, string> = {};

  for (const [mappingKey, jsonPath] of Object.entries(fieldMapping)) {
    const value = getByPath(payload, jsonPath);
    if (value == null || value === "") {
      missingFields.push(mappingKey);
      continue;
    }
    const stringValue = String(value);

    if (mappingKey === "contact.name") contactFields.name = stringValue;
    else if (mappingKey === "contact.phone") contactFields.phone = stringValue;
    else if (mappingKey === "contact.email") contactFields.email = stringValue;
    else if (mappingKey.startsWith("contact.custom."))
      contactCustomFields[mappingKey.replace("contact.custom.", "")] = stringValue;
    else if (mappingKey.startsWith("deal.custom."))
      dealCustomFields[mappingKey.replace("deal.custom.", "")] = stringValue;
  }

  if (!contactFields.phone) {
    return {
      ok: false,
      error:
        "Telefone do contato não foi resolvido no payload — não é possível criar/buscar o contato.",
      missingFields,
    };
  }

  const [existingContact] = await db
    .select({ id: contacts.id })
    .from(contacts)
    .where(eq(contacts.phone, contactFields.phone))
    .limit(1);

  let contactId: string;
  if (existingContact) {
    contactId = existingContact.id;
  } else {
    const [created] = await db
      .insert(contacts)
      .values({
        name: contactFields.name || contactFields.phone,
        phone: contactFields.phone,
        email: contactFields.email || null,
        customFields: contactCustomFields,
      })
      .returning({ id: contacts.id });
    contactId = created.id;
  }

  const temperature = await evaluateTemperature(dealCustomFields);

  const dealFieldDefs = await db
    .select({ key: customFieldDefinitions.key })
    .from(customFieldDefinitions)
    .where(eq(customFieldDefinitions.entity, "deal"));
  const knownDealKeys = new Set(dealFieldDefs.map((d) => d.key));
  const filteredDealCustomFields = Object.fromEntries(
    Object.entries(dealCustomFields).filter(([key]) => knownDealKeys.has(key))
  );

  const [createdDeal] = await db
    .insert(deals)
    .values({
      contactId,
      pipelineId: webhookConfig.defaultPipelineId,
      stageId: webhookConfig.defaultStageId,
      title: contactFields.name || contactFields.phone,
      customFields: filteredDealCustomFields,
      temperature,
    })
    .returning({ id: deals.id });

  return {
    ok: true,
    contactId,
    dealId: createdDeal.id,
    temperature,
    missingFields,
  };
}

export async function logInboundWebhook(
  webhookConfigId: string,
  payload: unknown,
  result: InboundProcessResult
): Promise<void> {
  await db.insert(webhookLogs).values({
    webhookConfigId,
    direction: "entrada",
    payload: payload as object,
    status: result.ok ? "sucesso" : "erro",
    errorMessage: result.ok
      ? result.missingFields.length > 0
        ? `Campos não resolvidos no payload: ${result.missingFields.join(", ")}`
        : null
      : result.error,
  });
}

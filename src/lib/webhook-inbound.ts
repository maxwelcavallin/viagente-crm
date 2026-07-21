import { eq, or } from "drizzle-orm";
import { db } from "@/db";
import {
  contacts,
  customFieldDefinitions,
  deals,
  temperatureRules,
  webhookLogs,
} from "@/db/schema";
import { logDealActivity } from "@/lib/deal-activity-log";
import { createAutomaticStageTasks } from "@/lib/deal-mutations";
import { findDuplicateContact } from "@/lib/contact-merge";
import {
  resolveDistributedOwner,
  syncContactOwnerFromDeal,
} from "@/lib/owner-distribution";
import { normalizePhoneNumber } from "@/lib/phone";
import { attachTagsToContact, attachTagsToDeal } from "@/lib/tags";

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
    contactTagIds?: unknown;
    dealTagIds?: unknown;
  },
  payload: unknown
): Promise<InboundProcessResult> {
  const fieldMapping = (webhookConfig.fieldMapping as FieldMapping) ?? {};
  const contactTagIds = (webhookConfig.contactTagIds as string[] | null) ?? [];
  const dealTagIds = (webhookConfig.dealTagIds as string[] | null) ?? [];

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
    else if (mappingKey === "contact.phone")
      contactFields.phone = normalizePhoneNumber(stringValue) ?? undefined;
    else if (mappingKey === "contact.email") contactFields.email = stringValue;
    else if (mappingKey.startsWith("contact.custom."))
      contactCustomFields[mappingKey.replace("contact.custom.", "")] = stringValue;
    else if (mappingKey.startsWith("deal.custom."))
      dealCustomFields[mappingKey.replace("deal.custom.", "")] = stringValue;
  }

  if (!contactFields.phone && !contactFields.email) {
    return {
      ok: false,
      error:
        "Nem telefone nem email do contato foram resolvidos no payload — não é possível criar/buscar o contato.",
      missingFields,
    };
  }

  // Casa por telefone OU email — mesma identidade "OR" usada na checagem de
  // duplicata da tela de contatos (ver findDuplicateContact em
  // src/lib/contact-merge.ts), só que aqui o objetivo é reaproveitar o
  // contato existente em vez de bloquear.
  const identityConditions = [
    contactFields.phone ? eq(contacts.phone, contactFields.phone) : undefined,
    contactFields.email ? eq(contacts.email, contactFields.email) : undefined,
  ].filter((c): c is NonNullable<typeof c> => c !== undefined);

  const [existingContact] = await db
    .select({ id: contacts.id, phone: contacts.phone, email: contacts.email })
    .from(contacts)
    .where(or(...identityConditions))
    .limit(1);

  let contactId: string;
  if (existingContact) {
    contactId = existingContact.id;

    // Lead pode cair de novo em outro funil/pipeline informando um contato
    // atualizado (trocou de telefone ou de email) — casado por um dos dois
    // campos, atualiza o outro pro valor mais recente informado. Nunca
    // sobrescreve com um valor que já pertence a OUTRO contato (evitaria
    // colidir com o índice único e criar ambiguidade de identidade).
    const nextEmail =
      contactFields.email && contactFields.email !== existingContact.email
        ? contactFields.email
        : undefined;
    const nextPhone =
      contactFields.phone && contactFields.phone !== existingContact.phone
        ? contactFields.phone
        : undefined;

    if (nextEmail || nextPhone) {
      const conflict = await findDuplicateContact(nextPhone ?? null, nextEmail ?? null, contactId);
      const updates: { email?: string; phone?: string } = {};
      if (nextEmail && conflict?.matchedField !== "email") updates.email = nextEmail;
      if (nextPhone && conflict?.matchedField !== "telefone") updates.phone = nextPhone;
      if (Object.keys(updates).length > 0) {
        await db.update(contacts).set(updates).where(eq(contacts.id, contactId));
      }
    }
  } else {
    const fallbackName = contactFields.phone || contactFields.email!;
    const [created] = await db
      .insert(contacts)
      .values({
        name: contactFields.name || fallbackName,
        phone: contactFields.phone || null,
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

  const distributedOwnerId = await resolveDistributedOwner(webhookConfig.defaultPipelineId);

  const [createdDeal] = await db
    .insert(deals)
    .values({
      contactId,
      pipelineId: webhookConfig.defaultPipelineId,
      stageId: webhookConfig.defaultStageId,
      title: contactFields.name || contactFields.phone || contactFields.email!,
      customFields: filteredDealCustomFields,
      temperature,
      ownerId: distributedOwnerId,
    })
    .returning({ id: deals.id });

  // Só propaga quando a distribuição de fato escolheu alguém — um negócio
  // novo sem dono não deve apagar o dono que o contato já tinha.
  if (distributedOwnerId) await syncContactOwnerFromDeal(contactId, distributedOwnerId);
  await createAutomaticStageTasks(createdDeal.id, webhookConfig.defaultStageId);

  await logDealActivity({
    dealId: createdDeal.id,
    userId: null,
    source: "webhook",
    action: "criado",
  });

  if (contactTagIds.length > 0) {
    await attachTagsToContact(contactId, contactTagIds);
  }
  if (dealTagIds.length > 0) {
    await attachTagsToDeal(createdDeal.id, dealTagIds);
  }

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

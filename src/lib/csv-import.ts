import { eq } from "drizzle-orm";
import { db } from "@/db";
import { contacts, customFieldDefinitions, deals } from "@/db/schema";
import { findDuplicateContact } from "@/lib/contact-merge";
import {
  resolveDistributedOwner,
  syncContactOwnerFromDeal,
} from "@/lib/owner-distribution";
import { attachTagsToContact, attachTagsToDeal, resolveOrCreateTagIds } from "@/lib/tags";
import {
  normalizePhone,
  resolveRow,
  type ColumnMapping,
  type DestinationConfig,
} from "@/lib/csv-import-resolve";

export type { ColumnMapping, DestinationConfig } from "@/lib/csv-import-resolve";
export { STAGE_COLUMN_KEY } from "@/lib/csv-import-resolve";

export type ImportRowError = { row: number; message: string };

export type ImportBatchResult = {
  contactsCreated: number;
  contactsUpdated: number;
  dealsCreated: number;
  errors: ImportRowError[];
};

export async function importCsvBatch(params: {
  headers: string[];
  rows: string[][];
  startRowNumber: number;
  mapping: ColumnMapping;
  destination: DestinationConfig;
}): Promise<ImportBatchResult> {
  const { headers, rows, startRowNumber, mapping, destination } = params;

  const [contactFieldDefs, dealFieldDefs] = await Promise.all([
    db
      .select({ key: customFieldDefinitions.key })
      .from(customFieldDefinitions)
      .where(eq(customFieldDefinitions.entity, "contact")),
    db
      .select({ key: customFieldDefinitions.key })
      .from(customFieldDefinitions)
      .where(eq(customFieldDefinitions.entity, "deal")),
  ]);
  const knownContactKeys = new Set(contactFieldDefs.map((d) => d.key));
  const knownDealKeys = new Set(dealFieldDefs.map((d) => d.key));

  const result: ImportBatchResult = {
    contactsCreated: 0,
    contactsUpdated: 0,
    dealsCreated: 0,
    errors: [],
  };

  for (let i = 0; i < rows.length; i++) {
    const rowNumber = startRowNumber + i;
    const resolved = resolveRow(headers, rows[i], mapping);

    if (!resolved.contactPhone) {
      result.errors.push({ row: rowNumber, message: "Telefone do contato não informado." });
      continue;
    }
    const phone = normalizePhone(resolved.contactPhone);
    if (!phone) {
      result.errors.push({ row: rowNumber, message: "Telefone do contato inválido." });
      continue;
    }

    let pipelineId: string;
    let stageId: string;
    if (destination.mode === "fixed") {
      pipelineId = destination.pipelineId;
      stageId = destination.stageId;
    } else {
      pipelineId = destination.pipelineId;
      const rawStage = resolved.stageRawValue?.trim();
      if (!rawStage) {
        result.errors.push({
          row: rowNumber,
          message: "Coluna de etapa vazia — linha não roteada pra nenhuma etapa.",
        });
        continue;
      }
      const mappedStageId = destination.stageMap[rawStage];
      if (!mappedStageId) {
        result.errors.push({
          row: rowNumber,
          message: `Etapa "${rawStage}" sem correspondência mapeada.`,
        });
        continue;
      }
      stageId = mappedStageId;
    }

    const filteredContactCustom = Object.fromEntries(
      Object.entries(resolved.contactCustomFields).filter(([key]) => knownContactKeys.has(key))
    );
    const filteredDealCustom = Object.fromEntries(
      Object.entries(resolved.dealCustomFields).filter(([key]) => knownDealKeys.has(key))
    );

    // Telefone OU email já cadastrado em outro contato: nunca cria
    // duplicado — atualiza o contato existente e cria só um negócio novo
    // pra ele (decisão explícita do usuário, mesmo padrão de "vincular em
    // vez de duplicar").
    const duplicate = await findDuplicateContact(phone, resolved.contactEmail);

    let contactId: string;
    if (duplicate) {
      contactId = duplicate.id;
      const [existingContact] = await db
        .select({ customFields: contacts.customFields })
        .from(contacts)
        .where(eq(contacts.id, contactId))
        .limit(1);
      await db
        .update(contacts)
        .set({
          ...(resolved.contactName ? { name: resolved.contactName } : {}),
          ...(resolved.contactEmail ? { email: resolved.contactEmail } : {}),
          customFields: {
            ...((existingContact?.customFields as Record<string, unknown>) ?? {}),
            ...filteredContactCustom,
          },
        })
        .where(eq(contacts.id, contactId));
      result.contactsUpdated += 1;
    } else {
      const [created] = await db
        .insert(contacts)
        .values({
          name: resolved.contactName || phone,
          phone,
          email: resolved.contactEmail,
          customFields: filteredContactCustom,
        })
        .returning({ id: contacts.id });
      contactId = created.id;
      result.contactsCreated += 1;
    }

    const distributedOwnerId = await resolveDistributedOwner(pipelineId);

    const [createdDeal] = await db
      .insert(deals)
      .values({
        contactId,
        pipelineId,
        stageId,
        title: resolved.dealTitle || resolved.contactName || phone,
        value: resolved.dealValue,
        customFields: filteredDealCustom,
        ownerId: distributedOwnerId,
      })
      .returning({ id: deals.id });
    result.dealsCreated += 1;

    // Só propaga quando a distribuição de fato escolheu alguém — um
    // negócio novo sem dono não deve apagar o dono que o contato já tinha.
    if (distributedOwnerId) await syncContactOwnerFromDeal(contactId, distributedOwnerId);

    if (resolved.contactTagNames.length > 0) {
      await attachTagsToContact(contactId, await resolveOrCreateTagIds(resolved.contactTagNames));
    }
    if (resolved.dealTagNames.length > 0) {
      await attachTagsToDeal(createdDeal.id, await resolveOrCreateTagIds(resolved.dealTagNames));
    }
  }

  return result;
}

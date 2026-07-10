import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { contacts, deals, pipelineOwnerDistribution } from "@/db/schema";
import { findOpenDealIdForContact } from "@/lib/messaging";

// Rodízio ponderado determinístico: escolhe sempre quem está mais
// "atrasado" em relação à cota (assignedCount/weight) — no longo prazo o
// percentual bate exatamente com o configurado, sem sequências longas pro
// mesmo usuário (diferente de sorteio ponderado). Retorna null se a
// pipeline não tem regra de distribuição configurada (comportamento
// original: negócio fica sem dono).
export async function resolveDistributedOwner(pipelineId: string): Promise<string | null> {
  const rows = await db
    .select()
    .from(pipelineOwnerDistribution)
    .where(eq(pipelineOwnerDistribution.pipelineId, pipelineId))
    .orderBy(asc(pipelineOwnerDistribution.createdAt));
  if (rows.length === 0) return null;

  let chosen = rows[0];
  let chosenRatio = chosen.assignedCount / chosen.weight;
  for (const row of rows.slice(1)) {
    const ratio = row.assignedCount / row.weight;
    if (ratio < chosenRatio) {
      chosen = row;
      chosenRatio = ratio;
    }
  }

  await db
    .update(pipelineOwnerDistribution)
    .set({ assignedCount: chosen.assignedCount + 1 })
    .where(eq(pipelineOwnerDistribution.id, chosen.id));

  return chosen.userId;
}

// Chamado sempre que o dono de um negócio é definido/alterado — mantém o
// dono do atendimento (contato) em sincronia. Um contato pode ter mais de
// um negócio aberto em pipelines diferentes; nesse caso o último negócio
// reatribuído "vence" aqui (simplificação deliberada, ver contexto do
// schema em contacts.ownerId).
export async function syncContactOwnerFromDeal(
  contactId: string,
  ownerId: string | null
): Promise<void> {
  await db.update(contacts).set({ ownerId }).where(eq(contacts.id, contactId));
}

// Inverso: dono do atendimento mudou → propaga pro negócio aberto desse
// contato, se existir (reaproveita a mesma heurística de "qual é o negócio
// deste contato" já usada pro envio de mensagem — ver findOpenDealIdForContact).
export async function syncDealOwnerFromContact(
  contactId: string,
  ownerId: string | null
): Promise<void> {
  await db.update(contacts).set({ ownerId }).where(eq(contacts.id, contactId));
  const openDealId = await findOpenDealIdForContact(contactId);
  if (openDealId) {
    await db.update(deals).set({ ownerId }).where(eq(deals.id, openDealId));
  }
}

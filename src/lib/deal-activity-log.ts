import { and, desc, eq, lt } from "drizzle-orm";
import { db } from "@/db";
import { dealActivityLog, users } from "@/db/schema";

export type DealActivityAction = typeof dealActivityLog.$inferSelect.action;
export type DealActivitySource = typeof dealActivityLog.$inferSelect.source;

// Ponto único de escrita — todo call site que muta um negócio (form manual,
// ações em massa, automation_sequences, webhook de entrada) passa por aqui
// em vez de fazer db.insert(dealActivityLog) direto, pra manter o formato
// consistente (ver Etapa 24, campo_alterado sempre com fieldName já
// traduzido pra label humana, não a chave raw da coluna/custom field).
//
// Nunca deixa o erro propagar: auditoria é observabilidade best-effort, não
// pode travar a ação de negócio que a disparou. Confirmado na prática — uma
// falha aqui (ex: user_id de uma sessão JWT apontando pra um usuário já
// excluído) chegou a abortar setDealStatusAction no meio, pulando a etapa
// seguinte de cancelActiveSequenceRuns porque a exceção subia sem ser pega.
export async function logDealActivity(params: {
  dealId: string;
  userId: string | null;
  action: DealActivityAction;
  fieldName?: string | null;
  oldValue?: string | null;
  newValue?: string | null;
  source: DealActivitySource;
}): Promise<void> {
  try {
    await db.insert(dealActivityLog).values({
      dealId: params.dealId,
      userId: params.userId,
      action: params.action,
      fieldName: params.fieldName ?? null,
      oldValue: params.oldValue ?? null,
      newValue: params.newValue ?? null,
      source: params.source,
    });
  } catch (error) {
    console.error("[deal-activity-log] falha ao gravar entrada de histórico", error);
  }
}

const PAGE_SIZE = 20;

export type DealActivityEntry = {
  id: string;
  action: DealActivityAction;
  fieldName: string | null;
  oldValue: string | null;
  newValue: string | null;
  source: DealActivitySource;
  createdAt: string;
  userName: string | null;
};

// Paginação por cursor (createdAt do último item da página anterior) em vez
// de offset — histórico cresce continuamente, offset desalinha se uma
// entrada nova chegar entre as páginas.
export async function getDealActivityLogPage(
  dealId: string,
  before?: string
): Promise<{ items: DealActivityEntry[]; hasMore: boolean }> {
  const rows = await db
    .select({
      id: dealActivityLog.id,
      action: dealActivityLog.action,
      fieldName: dealActivityLog.fieldName,
      oldValue: dealActivityLog.oldValue,
      newValue: dealActivityLog.newValue,
      source: dealActivityLog.source,
      createdAt: dealActivityLog.createdAt,
      userName: users.name,
    })
    .from(dealActivityLog)
    .leftJoin(users, eq(dealActivityLog.userId, users.id))
    .where(
      before
        ? and(eq(dealActivityLog.dealId, dealId), lt(dealActivityLog.createdAt, new Date(before)))
        : eq(dealActivityLog.dealId, dealId)
    )
    .orderBy(desc(dealActivityLog.createdAt))
    .limit(PAGE_SIZE + 1);

  const hasMore = rows.length > PAGE_SIZE;
  const items: DealActivityEntry[] = rows.slice(0, PAGE_SIZE).map((r) => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
  }));
  return { items, hasMore };
}

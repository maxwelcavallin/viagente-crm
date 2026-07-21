import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "../src/db";
import { deals, pipelineOwnerDistribution, pipelines, users } from "../src/db/schema";
import { resolveDistributedOwner, syncContactOwnerFromDeal } from "../src/lib/owner-distribution";

// Backfill único: atribui dono aos negócios ABERTOS que ficaram sem dono
// porque a regra de distribuição da pipeline (Configurações > Pipelines >
// editar > Distribuição de donos) foi configurada DEPOIS que esses negócios
// já existiam — resolveDistributedOwner só roda na criação/edição do
// negócio (ver createDealAction/updateDealAction/moveDealStage e os pontos
// de criação automática), nunca retroage sozinho quando uma regra nova é
// cadastrada. Achado real: quase toda pipeline com regra configurada tinha
// centenas de negócios abertos sem dono, todos criados antes da regra
// existir.
//
// Roda em dry-run por padrão (só imprime o que faria, sem tocar no banco —
// nem no assignedCount da distribuição). Passe --apply pra gravar de
// verdade: `tsx --env-file=.env.local scripts/backfill-deal-owners.ts --apply`
//
// No --apply, usa a mesma resolveDistributedOwner de sempre (rodízio
// ponderado real, incrementando assigned_count a cada chamada) — não
// hardcoda "manda tudo pro único usuário configurado": se uma pipeline tiver
// mais de um distribuidor, o rodízio decide negócio a negócio, e o
// assigned_count de cada um fica coerente pra distribuição futura continuar
// certa. Só negócios ABERTOS — negócio ganho/perdido é histórico fechado,
// atribuir dono retroativamente não muda nada operacional (mesma filosofia
// de não mexer em dado fechado do backfill de importação CSV).

async function main() {
  const apply = process.argv.includes("--apply");

  const pipelinesWithRule = await db
    .selectDistinct({ pipelineId: pipelineOwnerDistribution.pipelineId })
    .from(pipelineOwnerDistribution);

  let totalDeals = 0;
  let totalAssigned = 0;

  for (const { pipelineId } of pipelinesWithRule) {
    const [pipeline] = await db
      .select({ name: pipelines.name })
      .from(pipelines)
      .where(eq(pipelines.id, pipelineId))
      .limit(1);

    const unownedDeals = await db
      .select({ id: deals.id, contactId: deals.contactId })
      .from(deals)
      .where(and(eq(deals.pipelineId, pipelineId), eq(deals.status, "aberto"), isNull(deals.ownerId)))
      .orderBy(asc(deals.createdAt));

    if (unownedDeals.length === 0) continue;
    totalDeals += unownedDeals.length;

    if (!apply) {
      const distRows = await db
        .select({ userId: pipelineOwnerDistribution.userId, weight: pipelineOwnerDistribution.weight })
        .from(pipelineOwnerDistribution)
        .where(eq(pipelineOwnerDistribution.pipelineId, pipelineId));
      const userNames = await db.select({ id: users.id, name: users.name }).from(users);
      const nameById = new Map(userNames.map((u) => [u.id, u.name]));

      if (distRows.length === 1) {
        console.log(
          `[${pipeline?.name ?? pipelineId}] ${unownedDeals.length} negócio(s) aberto(s) sem dono -> todos iriam para ${nameById.get(distRows[0].userId) ?? distRows[0].userId}`
        );
      } else {
        console.log(
          `[${pipeline?.name ?? pipelineId}] ${unownedDeals.length} negócio(s) aberto(s) sem dono -> rodízio ponderado entre ${distRows.length} usuário(s) (${distRows.map((r) => `${nameById.get(r.userId) ?? r.userId} peso ${r.weight}`).join(", ")}), resultado exato só no --apply`
        );
      }
      continue;
    }

    for (const deal of unownedDeals) {
      const ownerId = await resolveDistributedOwner(pipelineId);
      if (!ownerId) continue;
      await db.update(deals).set({ ownerId }).where(eq(deals.id, deal.id));
      await syncContactOwnerFromDeal(deal.contactId, ownerId);
      totalAssigned++;
    }
    console.log(`[${pipeline?.name ?? pipelineId}] ${unownedDeals.length} negócio(s) receberam dono`);
  }

  console.log(`\n${apply ? "Aplicado" : "Dry run (nada foi gravado — rode com --apply pra confirmar)"}`);
  console.log(`Negócios abertos sem dono encontrados: ${totalDeals}`);
  if (apply) console.log(`Negócios que receberam dono: ${totalAssigned}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Erro ao atribuir dono retroativamente aos negócios:", error);
    process.exit(1);
  });

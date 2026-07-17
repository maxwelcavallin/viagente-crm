import { db } from "@/db";
import { autoDealSettings, deals } from "@/db/schema";
import { logDealActivity } from "@/lib/deal-activity-log";
import { resolveDistributedOwner, syncContactOwnerFromDeal } from "@/lib/owner-distribution";

// Config global (não por canal nem por tipo de canal, ver schema.ts) —
// chamado só quando o contato ainda não tem nenhum negócio aberto e a
// mensagem não é de grupo nem enviada pelo próprio atendente. Usado tanto
// pelo webhook do WhatsApp (src/app/api/whatsapp/webhook/[channelId]/route.ts)
// quanto pelo do Instagram (src/app/api/instagram/webhook/route.ts).
export async function maybeCreateAutoDeal(
  contactId: string,
  contactName: string
): Promise<string | null> {
  const [settings] = await db.select().from(autoDealSettings).limit(1);
  if (!settings?.active || !settings.pipelineId || !settings.stageId) return null;

  const distributedOwnerId = await resolveDistributedOwner(settings.pipelineId);

  const [createdDeal] = await db
    .insert(deals)
    .values({
      contactId,
      pipelineId: settings.pipelineId,
      stageId: settings.stageId,
      title: contactName,
      ownerId: distributedOwnerId,
    })
    .returning({ id: deals.id });

  // Mesmo raciocínio de processInboundPayload em webhook-inbound.ts: só
  // propaga quando a distribuição de fato escolheu alguém.
  if (distributedOwnerId) await syncContactOwnerFromDeal(contactId, distributedOwnerId);

  await logDealActivity({
    dealId: createdDeal.id,
    userId: null,
    source: "webhook",
    action: "criado",
  });

  return createdDeal.id;
}

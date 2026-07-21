import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { deals } from "@/db/schema";
import { getAllowedChannelIds } from "@/lib/channel-access";
import { getThreadPage } from "@/lib/conversations";
import { canViewOwnedRecord } from "@/lib/visibility";

export const dynamic = "force-dynamic";

// Espelha /api/deals/[id]/activity-log — consumido pelo botão "Carregar
// mensagens anteriores" do card de Histórico de conversa (ver
// deal-conversation-card.tsx). A primeira página vem direto no server
// component da página do negócio, esta rota só serve as anteriores.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "unauthenticated" }, { status: 401 });
  }

  const { id } = await params;

  const [deal] = await db
    .select({ ownerId: deals.ownerId, contactId: deals.contactId })
    .from(deals)
    .where(eq(deals.id, id))
    .limit(1);
  if (!deal || !canViewOwnedRecord(deal.ownerId, session.user)) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  const allowedChannelIds = await getAllowedChannelIds(session.user.id, session.user.role);
  const before = new URL(request.url).searchParams.get("before") ?? undefined;
  const page = await getThreadPage(deal.contactId, undefined, allowedChannelIds, before);
  return Response.json(page);
}

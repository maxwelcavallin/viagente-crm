import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { deals } from "@/db/schema";
import { getDealActivityLogPage } from "@/lib/deal-activity-log";
import { canViewOwnedRecord } from "@/lib/visibility";

export const dynamic = "force-dynamic";

// Consumido pelo botão "Carregar mais" do card de Histórico (ver
// deal-activity-log-card.tsx) — a primeira página vem direto no server
// component da página do negócio, esta rota só serve as seguintes.
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
    .select({ ownerId: deals.ownerId })
    .from(deals)
    .where(eq(deals.id, id))
    .limit(1);
  if (!deal || !canViewOwnedRecord(deal.ownerId, session.user)) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  const before = new URL(request.url).searchParams.get("before") ?? undefined;
  const page = await getDealActivityLogPage(id, before);
  return Response.json(page);
}

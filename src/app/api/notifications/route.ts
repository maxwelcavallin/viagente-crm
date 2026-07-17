import { and, count, desc, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { notifications } from "@/db/schema";

export const dynamic = "force-dynamic";

const RECENT_LIMIT = 30;

// Consumido pelo polling do sino de notificações (ver notification-bell.tsx)
// — devolve a contagem de não lidas e as mais recentes (lidas ou não),
// igual ao critério de aceite "dropdown com lista das mais recentes".
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "unauthenticated" }, { status: 401 });
  }

  const [items, [{ unreadCount }]] = await Promise.all([
    db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, session.user.id))
      .orderBy(desc(notifications.createdAt))
      .limit(RECENT_LIMIT),
    db
      .select({ unreadCount: count() })
      .from(notifications)
      .where(and(eq(notifications.userId, session.user.id), eq(notifications.read, false))),
  ]);

  return Response.json({ unreadCount, items });
}

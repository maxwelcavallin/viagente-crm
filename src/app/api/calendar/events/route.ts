import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { tasks } from "@/db/schema";
import { createCalendarEvent } from "@/lib/google-calendar";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "unauthenticated" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    title?: string;
    startAt?: string;
    endAt?: string;
    description?: string;
    contactEmail?: string | null;
    dealId?: string;
    taskId?: string;
  } | null;

  if (!body?.title?.trim() || !body?.startAt || !body?.endAt) {
    return Response.json(
      { error: "invalid_input", message: "title, startAt e endAt são obrigatórios" },
      { status: 400 }
    );
  }

  const startAt = new Date(body.startAt);
  const endAt = new Date(body.endAt);
  if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime()) || endAt <= startAt) {
    return Response.json(
      { error: "invalid_input", message: "Data/hora de início e fim inválidas" },
      { status: 400 }
    );
  }

  const dealLink = body.dealId ? `${new URL(request.url).origin}/negocios/${body.dealId}` : null;
  const description = [body.description?.trim(), dealLink ? `Negócio no CRM: ${dealLink}` : null]
    .filter(Boolean)
    .join("\n\n");

  try {
    const result = await createCalendarEvent(session.user.id, {
      title: body.title.trim(),
      description,
      startAt,
      endAt,
      attendeeEmail: body.contactEmail || null,
    });

    if (body.taskId) {
      await db.update(tasks).set({ googleEventId: result.id }).where(eq(tasks.id, body.taskId));
    }

    return Response.json({ id: result.id, htmlLink: result.htmlLink });
  } catch (e) {
    if (e instanceof Error && e.message === "NOT_CONNECTED") {
      return Response.json({ error: "not_connected" }, { status: 409 });
    }
    console.error("[api/calendar/events] falha ao criar evento", e);
    return Response.json(
      { error: "google_error", message: "Falha ao criar o evento no Google Agenda." },
      { status: 502 }
    );
  }
}

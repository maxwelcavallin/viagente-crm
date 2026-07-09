import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { scheduledMessages } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { id } = await params;

  const result = await db
    .update(scheduledMessages)
    .set({ status: "cancelada" })
    .where(and(eq(scheduledMessages.id, id), eq(scheduledMessages.status, "pendente")))
    .returning({ id: scheduledMessages.id });

  if (result.length === 0) {
    return Response.json(
      { error: "Mensagem agendada não encontrada ou já processada" },
      { status: 404 }
    );
  }

  return Response.json({ ok: true });
}

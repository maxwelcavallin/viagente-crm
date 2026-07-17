import { auth } from "@/auth";
import { sendDealEmail } from "@/lib/emails";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Não autenticado" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    dealId?: string;
    contactId?: string;
    taskId?: string;
    to?: string;
    subject?: string;
    body?: string;
    attachments?: { filename: string; key: string }[];
  } | null;

  if (!body?.dealId || !body?.contactId || !body?.to?.trim() || !body?.subject?.trim() || !body?.body?.trim()) {
    return Response.json(
      { error: "dealId, contactId, to, subject e body são obrigatórios" },
      { status: 400 }
    );
  }

  const result = await sendDealEmail({
    dealId: body.dealId,
    contactId: body.contactId,
    taskId: body.taskId || null,
    to: body.to.trim(),
    subject: body.subject.trim(),
    body: body.body,
    attachments: body.attachments ?? [],
    sentByUserId: session.user.id,
  });

  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 502 });
  }

  return Response.json({ ok: true, emailSentId: result.emailSentId });
}

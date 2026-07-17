import { authenticateApiRequest } from "@/lib/api-keys";
import { sendMessageForApiKey } from "@/lib/api-v1";

export const dynamic = "force-dynamic";

// POST /api/v1/messages/send  { "channelId": "...", "contactId": "...", "message": "..." }
// Mesmo motor de envio do composer (Etapa 5) e do cron de mensagens
// agendadas — ver sendTextMessage em src/lib/send-message.ts.
export async function POST(request: Request) {
  const auth = await authenticateApiRequest(request);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  const body = (await request.json().catch(() => null)) as {
    channelId?: string;
    contactId?: string;
    message?: string;
  } | null;
  if (!body?.channelId || !body?.contactId || !body?.message?.trim()) {
    return Response.json(
      { error: "channelId, contactId e message são obrigatórios." },
      { status: 400 }
    );
  }

  const result = await sendMessageForApiKey(auth.apiKey, {
    channelId: body.channelId,
    contactId: body.contactId,
    message: body.message.trim(),
  });
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });

  return Response.json({ message: result.data });
}

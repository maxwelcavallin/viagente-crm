import { eq } from "drizzle-orm";
import { db } from "@/db";
import { webhookConfigs } from "@/db/schema";
import { logInboundWebhook, processInboundPayload } from "@/lib/webhook-inbound";
import { dispatchOutboundWebhooks } from "@/lib/webhook-outbound";

export const dynamic = "force-dynamic";

// Autenticação por secret_token: aceita tanto header `x-webhook-secret`
// quanto query param `?token=` — cobre ferramentas de formulário externas
// que só permitem configurar a URL, sem headers customizados.
function extractToken(request: Request): string | null {
  const header = request.headers.get("x-webhook-secret");
  if (header) return header;
  const url = new URL(request.url);
  return url.searchParams.get("token");
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [config] = await db
    .select()
    .from(webhookConfigs)
    .where(eq(webhookConfigs.id, id))
    .limit(1);

  if (!config || config.direction !== "entrada") {
    return Response.json({ error: "Webhook não encontrado" }, { status: 404 });
  }
  if (!config.active) {
    return Response.json({ error: "Webhook inativo" }, { status: 403 });
  }

  const token = extractToken(request);
  if (!token || token !== config.secretToken) {
    return Response.json({ error: "Token inválido" }, { status: 401 });
  }

  const payload = await request.json().catch(() => null);
  if (payload === null) {
    return Response.json({ error: "Payload JSON inválido" }, { status: 400 });
  }

  const result = await processInboundPayload(config, payload);
  await logInboundWebhook(config.id, payload, result);

  if (result.ok) {
    void dispatchOutboundWebhooks("negocio_criado", result.dealId);
    return Response.json({
      ok: true,
      contactId: result.contactId,
      dealId: result.dealId,
      temperature: result.temperature,
      missingFields: result.missingFields,
    });
  }

  return Response.json(
    { ok: false, error: result.error, missingFields: result.missingFields },
    { status: 200 }
  );
}

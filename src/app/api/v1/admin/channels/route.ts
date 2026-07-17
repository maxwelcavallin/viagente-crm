import { authenticateApiRequest } from "@/lib/api-keys";
import { listChannelsForApiKey } from "@/lib/api-v1-admin";

export const dynamic = "force-dynamic";

// GET /api/v1/admin/channels — requer chave admin. Somente leitura: nunca
// inclui token/credencial de canal, e não existe create/update/delete aqui
// (conexão de canal continua exclusiva da UI, ver Etapa 28).
export async function GET(request: Request) {
  const auth = await authenticateApiRequest(request);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  const result = await listChannelsForApiKey(auth.apiKey);
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
  return Response.json({ channels: result.data });
}

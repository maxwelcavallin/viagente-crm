import { auth } from "@/auth";
import { runLeadDeltaSync } from "@/lib/leaddelta-sync";

// Sincronização pode levar bastante tempo (paginação completa + espera em
// rate limit) dependendo do volume de conexões — maxDuration alto pra não
// estourar o limite padrão de função serverless.
export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function POST() {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    return Response.json({ error: "unauthenticated" }, { status: 401 });
  }

  const result = await runLeadDeltaSync();
  if (!result.ok) {
    const status = result.message === "API Key da LeadDelta não configurada." ? 400 : 502;
    return Response.json({ ok: false, message: result.message }, { status });
  }

  return Response.json(result);
}

import { registerOAuthClient } from "@/lib/mcp-oauth";

export const dynamic = "force-dynamic";

// Dynamic Client Registration (RFC 7591) — o claude.ai chama isso sozinho,
// sem intervenção do admin, quando o "Adicionar conector personalizado" não
// tem um Client ID OAuth pré-preenchido. Público de propósito (sem sessão
// nem API key): é assim que qualquer cliente MCP novo se registra antes de
// existir qualquer credencial. Registra como cliente público (sem secret) —
// mesma classificação que o claude.ai já assume pra DCR/CIMD.
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_client_metadata" }, { status: 400 });
  }

  const redirectUris = (body as { redirect_uris?: unknown }).redirect_uris;
  if (!Array.isArray(redirectUris) || redirectUris.some((u) => typeof u !== "string") || redirectUris.length === 0) {
    return Response.json(
      { error: "invalid_client_metadata", error_description: "redirect_uris é obrigatório." },
      { status: 400 }
    );
  }

  const clientName =
    typeof (body as { client_name?: unknown }).client_name === "string"
      ? (body as { client_name: string }).client_name
      : null;

  const { clientId } = await registerOAuthClient({
    clientName,
    redirectUris: redirectUris as string[],
  });

  return Response.json(
    {
      client_id: clientId,
      client_name: clientName,
      redirect_uris: redirectUris,
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code"],
      response_types: ["code"],
      client_id_issued_at: Math.floor(Date.now() / 1000),
    },
    { status: 201, headers: { "cache-control": "no-store" } }
  );
}

import { headers } from "next/headers";

// Monta a URL absoluta real da requisição atual (host + protocolo), pra
// exibir URLs de webhook que o usuário vai copiar pra fora do CRM (Z-API,
// plataformas externas). Nunca hardcoda domínio: funciona igual em
// localhost, preview da Vercel e produção, sem exigir variável de ambiente.
export async function getBaseUrl(): Promise<string> {
  const headersList = await headers();
  const host = headersList.get("host") ?? "localhost:3000";
  const proto = headersList.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

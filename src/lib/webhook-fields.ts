// Chaves do field_mapping usam prefixo pra já vir roteado: "contact.name",
// "contact.phone", "contact.email", "contact.custom.<key>", "deal.title",
// "deal.value", "deal.custom.<key>". Tags NÃO entram aqui (Etapa 13): não
// vêm mais de um caminho no payload/coluna — são selecionadas estaticamente
// (ver contactTagIds/dealTagIds em webhook_configs e a seção "Tags" própria
// no wizard de importação), pra nunca depender de digitar um path/nome.
// Arquivo separado de webhook-inbound.ts (que importa `db`) porque este é
// importado também por componentes client (FieldMappingEditor) — ver nota
// em deal-format.ts sobre o mesmo problema de fronteira client/server.
export const CONTACT_SYSTEM_FIELDS = [
  { key: "contact.name", label: "Nome do contato" },
  { key: "contact.phone", label: "Telefone do contato" },
  { key: "contact.email", label: "Email do contato" },
] as const;

// Título/valor do negócio — não usados pelo webhook de entrada em si (que
// sempre deriva o título do nome do contato), mas fazem parte do mesmo
// vocabulário de mapeamento e são reaproveitados pela importação de CSV
// (Etapa 11), que também precisa desses campos.
export const DEAL_SYSTEM_FIELDS = [
  { key: "deal.title", label: "Título do negócio" },
  { key: "deal.value", label: "Valor do negócio" },
  // Só a importação de CSV usa este campo (webhook de entrada sempre cria
  // negócio "aberto" — ver processInboundPayload). Valores aceitos:
  // aberto/ganho/perdido (ver dealStatusEnum em src/db/schema.ts).
  { key: "deal.status", label: "Status do negócio (aberto/ganho/perdido)" },
] as const;

export type DiscoveredPayloadField = { path: string; preview: string };

// Achata um payload real (capturado de uma execução de verdade do webhook —
// ver webhook_logs.payload) em pares caminho/prévia, pra alimentar o select
// de "de onde vem esse campo" no FieldMappingEditor, sem exigir que o
// usuário digite o caminho de cabeça. Só entra em objeto puro; array vira
// prévia "[N item(ns)]" e não é decomposto (mapeamento não suporta índice de
// array — ver getByPath em webhook-inbound.ts).
export function flattenPayloadPaths(payload: unknown, prefix = ""): DiscoveredPayloadField[] {
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
    return [];
  }
  const result: DiscoveredPayloadField[] = [];
  for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      result.push(...flattenPayloadPaths(value, path));
    } else {
      const preview = Array.isArray(value)
        ? `[${value.length} item(ns)]`
        : String(value);
      result.push({ path, preview });
    }
  }
  return result;
}

// Chaves do field_mapping usam prefixo pra já vir roteado: "contact.name",
// "contact.phone", "contact.email", "contact.tags", "contact.custom.<key>",
// "deal.title", "deal.value", "deal.tags", "deal.custom.<key>".
// Arquivo separado de webhook-inbound.ts (que importa `db`) porque este é
// importado também por componentes client (FieldMappingEditor) — ver nota
// em deal-format.ts sobre o mesmo problema de fronteira client/server.
export const CONTACT_SYSTEM_FIELDS = [
  { key: "contact.name", label: "Nome do contato" },
  { key: "contact.phone", label: "Telefone do contato" },
  { key: "contact.email", label: "Email do contato" },
  { key: "contact.tags", label: "Tags do contato (separadas por vírgula)" },
] as const;

// Título/valor/tags do negócio — não usados pelo webhook de entrada em si
// (que sempre deriva o título do nome do contato), mas fazem parte do mesmo
// vocabulário de mapeamento e são reaproveitados pela importação de CSV
// (Etapa 11), que também precisa desses campos.
export const DEAL_SYSTEM_FIELDS = [
  { key: "deal.title", label: "Título do negócio" },
  { key: "deal.value", label: "Valor do negócio" },
  { key: "deal.tags", label: "Tags do negócio (separadas por vírgula)" },
] as const;

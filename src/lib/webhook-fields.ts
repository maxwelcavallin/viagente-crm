// Chaves do field_mapping usam prefixo pra já vir roteado: "contact.name",
// "contact.phone", "contact.email", "contact.custom.<key>", "deal.custom.<key>".
// Arquivo separado de webhook-inbound.ts (que importa `db`) porque este é
// importado também por componentes client (FieldMappingEditor) — ver nota
// em deal-format.ts sobre o mesmo problema de fronteira client/server.
export const CONTACT_SYSTEM_FIELDS = [
  { key: "contact.name", label: "Nome do contato" },
  { key: "contact.phone", label: "Telefone do contato" },
  { key: "contact.email", label: "Email do contato" },
] as const;

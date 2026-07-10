const VARIABLE_PATTERN = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

export function extractVariables(content: string): string[] {
  const matches = content.matchAll(VARIABLE_PATTERN);
  return Array.from(new Set(Array.from(matches, (m) => m[1])));
}

export function substituteTemplate(
  content: string,
  values: Record<string, string>
): string {
  return content.replace(VARIABLE_PATTERN, (match, key: string) =>
    key in values ? values[key] : match
  );
}

export type TemplateVariableInfo = {
  key: string;
  label: string;
  example: string;
};

// Catálogo de variáveis disponíveis pro editor de template: nome do contato +
// valor do negócio são fixos; o resto vem de custom_field_definitions
// (contato e negócio) já cadastrados.
export function buildVariableCatalog(
  fieldDefinitions: {
    key: string;
    label: string;
    type: "texto" | "numero" | "select" | "data";
    options: { value: string; label: string }[] | null;
    entity: "contact" | "deal";
  }[]
): TemplateVariableInfo[] {
  const base: TemplateVariableInfo[] = [
    { key: "nome_contato", label: "Nome do contato", example: "Maria Silva" },
    { key: "email_contato", label: "Email do contato", example: "maria@email.com" },
    { key: "valor", label: "Valor do negócio", example: "R$ 1.500,00" },
  ];

  const fromFields = fieldDefinitions.map((field) => ({
    key: field.key,
    label: `${field.label} (${field.entity === "contact" ? "contato" : "negócio"})`,
    example: exampleForField(field),
  }));

  return [...base, ...fromFields];
}

function exampleForField(field: {
  type: "texto" | "numero" | "select" | "data";
  options: { value: string; label: string }[] | null;
}): string {
  if (field.type === "select") return field.options?.[0]?.label ?? "Exemplo";
  if (field.type === "numero") return "123";
  if (field.type === "data") return new Date().toLocaleDateString("pt-BR");
  return "Exemplo";
}

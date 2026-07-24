import { asc } from "drizzle-orm";
import { db } from "@/db";
import { messageTemplateItems, messageTemplates } from "@/db/schema";

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

// Tudo antes do primeiro espaço do nome completo — base da variável
// "primeiro_nome" (ver buildVariableCatalog). Centralizado aqui pra todo
// lugar que monta variableValues (tarefas, automação, NPS, atendimento)
// calcular do mesmo jeito.
export function firstNameOf(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? "";
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
    { key: "primeiro_nome", label: "Primeiro nome do contato", example: "Maria" },
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

export type QuickFillMessageTemplate = {
  id: string;
  name: string;
  content: string;
  hasMedia: boolean;
};

// Usado pelos seletores de "preencher com template" em campos de texto livre
// (agendamento de mensagem no Atendimento e no negócio) — junta os itens do
// template num texto só, já com as variáveis substituídas pelos valores
// desse contato/negócio. scheduled_messages só guarda texto (sem suporte a
// mídia, ver cron send-scheduled-messages), então anexos do template não
// entram no conteúdo — hasMedia avisa a UI quando isso acontece.
export async function getQuickFillMessageTemplates(
  variableValues: Record<string, string>
): Promise<QuickFillMessageTemplate[]> {
  const [templateRows, itemRows] = await Promise.all([
    db
      .select({ id: messageTemplates.id, name: messageTemplates.name })
      .from(messageTemplates)
      .orderBy(asc(messageTemplates.name)),
    db
      .select({
        templateId: messageTemplateItems.templateId,
        content: messageTemplateItems.content,
        mediaType: messageTemplateItems.mediaType,
      })
      .from(messageTemplateItems)
      .orderBy(asc(messageTemplateItems.order)),
  ]);

  const itemsByTemplateId = new Map<string, typeof itemRows>();
  for (const item of itemRows) {
    const list = itemsByTemplateId.get(item.templateId) ?? [];
    list.push(item);
    itemsByTemplateId.set(item.templateId, list);
  }

  return templateRows.map((template) => {
    const items = itemsByTemplateId.get(template.id) ?? [];
    return {
      id: template.id,
      name: template.name,
      content: items
        .map((item) => substituteTemplate(item.content, variableValues))
        .filter(Boolean)
        .join("\n\n"),
      hasMedia: items.some((item) => Boolean(item.mediaType)),
    };
  });
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

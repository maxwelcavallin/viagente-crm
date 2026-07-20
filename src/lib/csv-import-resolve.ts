// Lógica pura de resolução/roteamento de linha de CSV — sem tocar em banco.
// Módulo separado de csv-import.ts (que importa `db`) porque este também é
// importado por componentes client (o wizard de importação, pro preview
// instantâneo antes de confirmar) — mesmo problema de fronteira
// client/server documentado em deal-format.ts / webhook-fields.ts.

import { splitTagNames } from "@/lib/tag-parse";

export const STAGE_COLUMN_KEY = "_stage";

export type ColumnMapping = Record<string, string>;

export type DestinationConfig =
  | { mode: "fixed"; pipelineId: string; stageId: string }
  | {
      mode: "by_column";
      pipelineId: string;
      stageColumn: string;
      stageMap: Record<string, string>;
    };

export function parseImportNumber(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  let normalized = trimmed.replace(/[^\d.,-]/g, "");
  if (normalized.includes(".") && normalized.includes(",")) {
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  } else if (normalized.includes(",")) {
    normalized = normalized.replace(",", ".");
  }
  const amount = Number(normalized);
  if (Number.isNaN(amount)) return null;
  return amount.toFixed(2);
}

// Normaliza telefone só removendo espaços/pontuação de formatação comum
// (mantém dígitos e o "+" opcional) — mesma tolerância usada no resto do
// app pra bater com o índice único de contacts.phone.
export function normalizePhone(raw: string): string {
  return raw.replace(/[^\d+]/g, "");
}

export type DealStatus = "aberto" | "ganho" | "perdido";

const STATUS_ALIASES: Record<string, DealStatus> = {
  aberto: "aberto",
  ganho: "ganho",
  ganha: "ganho",
  ganhou: "ganho",
  won: "ganho",
  perdido: "perdido",
  perdida: "perdido",
  perdeu: "perdido",
  lost: "perdido",
  open: "aberto",
};

// Aceita variações comuns em português/inglês de planilhas de outros CRMs —
// null quando não reconhece (csv-import.ts trata como erro na linha, não
// ignora silenciosamente pra não gravar negócio com status errado).
export function normalizeDealStatus(raw: string): DealStatus | null {
  return STATUS_ALIASES[raw.trim().toLowerCase()] ?? null;
}

export type ResolvedRow = {
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  contactCustomFields: Record<string, string>;
  contactTagNames: string[];
  dealTitle: string | null;
  dealValue: string | null;
  dealStatus: string | null;
  dealCustomFields: Record<string, string>;
  dealTagNames: string[];
  stageRawValue: string | null;
};

export function resolveRow(
  headers: string[],
  rowValues: string[],
  mapping: ColumnMapping
): ResolvedRow {
  const resolved: ResolvedRow = {
    contactName: null,
    contactPhone: null,
    contactEmail: null,
    contactCustomFields: {},
    contactTagNames: [],
    dealTitle: null,
    dealValue: null,
    dealStatus: null,
    dealCustomFields: {},
    dealTagNames: [],
    stageRawValue: null,
  };

  headers.forEach((column, index) => {
    const target = mapping[column];
    if (!target) return;
    const cell = (rowValues[index] ?? "").trim();
    if (!cell) return;

    if (target === "contact.name") resolved.contactName = cell;
    else if (target === "contact.phone") resolved.contactPhone = cell;
    else if (target === "contact.email") resolved.contactEmail = cell;
    else if (target === "contact.tags") resolved.contactTagNames.push(...splitTagNames(cell));
    else if (target === "deal.title") resolved.dealTitle = cell;
    else if (target === "deal.value") resolved.dealValue = parseImportNumber(cell);
    else if (target === "deal.status") resolved.dealStatus = cell;
    else if (target === "deal.tags") resolved.dealTagNames.push(...splitTagNames(cell));
    else if (target === STAGE_COLUMN_KEY) resolved.stageRawValue = cell;
    else if (target.startsWith("contact.custom."))
      resolved.contactCustomFields[target.replace("contact.custom.", "")] = cell;
    else if (target.startsWith("deal.custom."))
      resolved.dealCustomFields[target.replace("deal.custom.", "")] = cell;
  });

  return resolved;
}

export type ImportPreviewRow = {
  row: number;
  contactName: string;
  contactPhone: string | null;
  contactEmail: string | null;
  dealTitle: string;
  stageLabel: string;
  error: string | null;
};

// Mesma lógica de resolução/roteamento usada na execução real (ver
// importCsvBatch em csv-import.ts), mas sem tocar no banco — usada pra
// montar o preview antes de confirmar.
export function previewCsvRows(
  headers: string[],
  rows: string[][],
  mapping: ColumnMapping,
  destination: DestinationConfig,
  stageLabelById: Map<string, string>
): ImportPreviewRow[] {
  return rows.map((rowValues, i) => {
    const rowNumber = i + 1;
    const resolved = resolveRow(headers, rowValues, mapping);

    if (!resolved.contactPhone && !resolved.contactEmail) {
      return {
        row: rowNumber,
        contactName: resolved.contactName ?? "—",
        contactPhone: null,
        contactEmail: null,
        dealTitle: resolved.dealTitle ?? "—",
        stageLabel: "—",
        error: "Telefone ou email do contato não informado.",
      };
    }
    const identity = resolved.contactPhone || resolved.contactEmail!;

    let stageLabel = "—";
    let error: string | null = null;
    if (destination.mode === "fixed") {
      stageLabel = stageLabelById.get(destination.stageId) ?? "—";
    } else {
      const rawStage = resolved.stageRawValue?.trim();
      if (!rawStage) {
        error = "Coluna de etapa vazia — linha não roteada pra nenhuma etapa.";
      } else {
        const mappedStageId = destination.stageMap[rawStage];
        if (!mappedStageId) {
          error = `Etapa "${rawStage}" sem correspondência mapeada.`;
        } else {
          stageLabel = stageLabelById.get(mappedStageId) ?? "—";
        }
      }
    }
    if (!error && resolved.dealStatus && !normalizeDealStatus(resolved.dealStatus)) {
      error = `Status "${resolved.dealStatus}" não reconhecido — use aberto, ganho ou perdido.`;
    }

    return {
      row: rowNumber,
      contactName: resolved.contactName || identity,
      contactPhone: resolved.contactPhone,
      contactEmail: resolved.contactEmail,
      dealTitle: resolved.dealTitle || resolved.contactName || identity,
      stageLabel,
      error,
    };
  });
}

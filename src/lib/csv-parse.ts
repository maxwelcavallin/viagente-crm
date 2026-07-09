// Parser de CSV escrito à mão (sem dependência externa) — suporta campos
// entre aspas com vírgula/ponto-e-vírgula/quebra de linha embutidos e aspas
// escapadas (""), nos moldes do RFC 4180. Detecta automaticamente se o
// delimitador é vírgula ou ponto-e-vírgula (exports em pt-BR do Excel/Clint
// costumam usar ; já que vírgula é separador decimal).

export type ParsedCsv = {
  headers: string[];
  rows: string[][];
};

function detectDelimiter(firstLine: string): "," | ";" {
  const commaCount = (firstLine.match(/,/g) ?? []).length;
  const semicolonCount = (firstLine.match(/;/g) ?? []).length;
  return semicolonCount > commaCount ? ";" : ",";
}

function parseRows(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;

  // Normaliza CRLF -> LF pra simplificar a máquina de estados; quebras de
  // linha dentro de campo entre aspas continuam preservadas no valor.
  const normalized = text.replace(/\r\n/g, "\n");

  while (i < normalized.length) {
    const char = normalized[i];

    if (inQuotes) {
      if (char === '"') {
        if (normalized[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += char;
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (char === delimiter) {
      row.push(field);
      field = "";
      i += 1;
      continue;
    }
    if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i += 1;
      continue;
    }
    field += char;
    i += 1;
  }

  // Última linha sem quebra final.
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

export function parseCsv(text: string): ParsedCsv {
  const withoutBom = text.replace(/^﻿/, "");
  const firstLineEnd = withoutBom.indexOf("\n");
  const firstLine = (firstLineEnd === -1 ? withoutBom : withoutBom.slice(0, firstLineEnd)).replace(
    /\r$/,
    ""
  );
  const delimiter = detectDelimiter(firstLine);

  const allRows = parseRows(withoutBom, delimiter).filter(
    (r) => !(r.length === 1 && r[0].trim() === "")
  );
  if (allRows.length === 0) return { headers: [], rows: [] };

  const [headers, ...rows] = allRows;
  return { headers: headers.map((h) => h.trim()), rows };
}

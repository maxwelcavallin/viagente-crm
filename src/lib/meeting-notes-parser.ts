// Parser do documento de notas do Gemini (Etapa 31) — calibrado contra um
// export real (PT-BR) de "Notes by Gemini". Achados que moldaram este
// parser (ver plano da etapa): o título do doc de notas NÃO contém "Notes
// by Gemini", é o título da própria reunião; o Gemini às vezes gera um
// segundo anexo separado (título terminando em "- Transcrição"/"-
// Transcript") e às vezes tudo cai num único doc, com a transcrição
// concatenada logo depois do bloco de notas.
//
// Estrutura reconhecida, nesta ordem: "Resumo"/"Summary" → "Próximas
// etapas"/"Next steps" (itens de ação, um por linha, formato
// "[Nome] Título: Descrição.") → "Detalhes"/"Details" → boilerplate de
// feedback do Google (fim do conteúdo de notas) → cabeçalho "<título> -
// Transcrição"/"- Transcript" → falas da reunião → boilerplate de rodapé
// (fim da transcrição). Documentos que não batem com nenhum desses
// títulos de seção caem no fallback: texto bruto inteiro em `summary`,
// `parsedOk: false` — não tem por que falhar a sincronização, só sinalizar
// pra revisão manual (o formato pode variar por idioma ou versão futura
// do Gemini).

export type ParsedGeminiNotes = {
  summary: string;
  actionItems: string[] | null;
  transcript: string | null;
  parsedOk: boolean;
};

const SUMMARY_HEADINGS = ["resumo", "summary"];
const ACTION_ITEMS_HEADINGS = ["próximas etapas", "next steps", "suggested next steps"];
const DETAILS_HEADINGS = ["detalhes", "details"];
const FEEDBACK_MARKER = /revise as anota[cç][aã]o|revise as anota[cç][oõ]es do gemini|review gemini'?s notes|rate these notes/i;
// Também usado em meeting-notes-sync.ts pra classificar o ANEXO de
// transcrição pelo título (mesma terminação "- Transcrição"/"- Transcript").
export const TRANSCRIPT_TITLE_SUFFIX = /-\s*(transcri[cç][aã]o|transcript)\s*$/i;
const TRANSCRIPT_END_MARKER =
  /esta transcri[cç][aã]o edit[aá]vel foi gerada por computador|this editable transcript was generated/i;

function normalizeLines(text: string): string[] {
  return text.replace(/\r\n/g, "\n").split("\n");
}

function findHeadingIndex(lines: string[], headings: string[], fromIndex: number): number {
  const normalized = headings.map((h) => h.toLowerCase());
  for (let i = fromIndex; i < lines.length; i++) {
    if (normalized.includes(lines[i].trim().toLowerCase())) return i;
  }
  return -1;
}

function findMarkerIndex(lines: string[], pattern: RegExp, fromIndex: number): number {
  for (let i = fromIndex; i < lines.length; i++) {
    if (pattern.test(lines[i])) return i;
  }
  return -1;
}

function block(lines: string[], start: number, end: number): string {
  return lines
    .slice(Math.max(start, 0), Math.max(end, start))
    .join("\n")
    .trim();
}

function cutAtMarker(text: string, pattern: RegExp): string {
  const lines = normalizeLines(text);
  const idx = findMarkerIndex(lines, pattern, 0);
  return (idx === -1 ? text : lines.slice(0, idx).join("\n")).trim();
}

export function parseGeminiNotesDoc(
  notesText: string,
  transcriptText?: string | null
): ParsedGeminiNotes {
  const lines = normalizeLines(notesText);

  const summaryIdx = findHeadingIndex(lines, SUMMARY_HEADINGS, 0);
  const actionsIdx =
    summaryIdx === -1 ? -1 : findHeadingIndex(lines, ACTION_ITEMS_HEADINGS, summaryIdx + 1);

  if (summaryIdx === -1 || actionsIdx === -1) {
    return {
      summary: notesText.trim(),
      actionItems: null,
      transcript: transcriptText ? cutAtMarker(transcriptText, TRANSCRIPT_END_MARKER) : null,
      parsedOk: false,
    };
  }

  const detailsIdx = findHeadingIndex(lines, DETAILS_HEADINGS, actionsIdx + 1);
  const feedbackIdx = findMarkerIndex(lines, FEEDBACK_MARKER, actionsIdx + 1);
  const notesEndIdx = feedbackIdx !== -1 ? feedbackIdx : lines.length;

  const summaryBlock = block(lines, summaryIdx + 1, actionsIdx);
  const detailsBlock = detailsIdx === -1 ? "" : block(lines, detailsIdx + 1, notesEndIdx);
  const actionsBlock = block(lines, actionsIdx + 1, detailsIdx === -1 ? notesEndIdx : detailsIdx);

  const summary = detailsBlock
    ? `${summaryBlock}\n\nDetalhes\n${detailsBlock}`
    : summaryBlock;

  const actionItems = actionsBlock
    ? actionsBlock
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
    : null;

  let transcript: string | null = null;
  if (transcriptText) {
    transcript = cutAtMarker(transcriptText, TRANSCRIPT_END_MARKER);
  } else {
    const transcriptHeadingIdx = findMarkerIndex(lines, TRANSCRIPT_TITLE_SUFFIX, notesEndIdx);
    if (transcriptHeadingIdx !== -1) {
      transcript = cutAtMarker(
        block(lines, transcriptHeadingIdx + 1, lines.length),
        TRANSCRIPT_END_MARKER
      );
    }
  }

  return {
    summary,
    actionItems: actionItems && actionItems.length > 0 ? actionItems : null,
    transcript: transcript || null,
    parsedOk: true,
  };
}

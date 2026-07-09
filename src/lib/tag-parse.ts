// Puro, sem `db` — importado tanto por src/lib/tags.ts (server) quanto por
// src/lib/csv-import-resolve.ts (também usado por componentes client, pro
// preview de importação).
export function splitTagNames(raw: string): string[] {
  return raw
    .split(/[,;|]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

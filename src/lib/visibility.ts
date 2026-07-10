import { eq, isNull, or, sql, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";

export type VisibilityUser = {
  id: string;
  role: "admin" | "atendente";
  restrictToOwnRecords: boolean;
};

// Condição pra usar num .where()/and(): quando o usuário está restrito
// (nunca admin, ver users.restrictToOwnRecords), só deixa passar linhas
// dele mesmo ou sem dono — não atribuídos continuam visíveis pra qualquer
// atendente poder assumi-los. sql`true` (em vez de undefined) pra compor
// direto com and() sem precisar tratar caso especial em cada chamador.
export function ownerVisibilityFilter(
  ownerColumn: PgColumn,
  user: VisibilityUser
): SQL {
  if (user.role === "admin" || !user.restrictToOwnRecords) return sql`true`;
  return or(eq(ownerColumn, user.id), isNull(ownerColumn))!;
}

// Pra checagem pontual (ex: acesso direto por URL a um negócio/contato
// específico) em vez de filtrar uma listagem.
export function canViewOwnedRecord(
  ownerId: string | null,
  user: VisibilityUser
): boolean {
  if (user.role === "admin" || !user.restrictToOwnRecords) return true;
  return ownerId === null || ownerId === user.id;
}

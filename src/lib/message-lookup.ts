import { gte, lt } from "drizzle-orm";
import { messages } from "@/db/schema";

// messages.created_at é timestamptz com precisão de microssegundos no Postgres
// (defaultNow()), mas o driver pg trunca a fração pro milissegundo ao converter
// pra JS Date — então o createdAt que volta do cliente (via toISOString()) quase
// nunca bate com eq() contra o valor gravado. Usar uma janela de 1ms em vez de
// igualdade exata evita o falso "Mensagem não encontrada" em editar/apagar/favoritar.
export function createdAtMatch(createdAt: Date) {
  return [
    gte(messages.createdAt, createdAt),
    lt(messages.createdAt, new Date(createdAt.getTime() + 1)),
  ] as const;
}

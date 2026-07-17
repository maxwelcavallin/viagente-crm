import { db } from "@/db";
import { apiWriteLog } from "@/db/schema";

// Auditoria genérica de escrita via API/MCP (Etapa 28) — ver comentário do
// schema em apiWriteLog. Nunca deixa o erro propagar: mesmo raciocínio de
// logDealActivity (observabilidade best-effort não pode travar a ação de
// negócio que a disparou).
export async function logApiWrite(
  apiKeyId: string,
  entityType: string,
  entityId: string | null,
  action: string
): Promise<void> {
  try {
    await db.insert(apiWriteLog).values({ apiKeyId, entityType, entityId, action });
  } catch (error) {
    console.error("[api-audit] falha ao gravar entrada de auditoria", error);
  }
}

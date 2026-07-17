"use server";

import { recordNpsResponse, type NpsResponseResult } from "@/lib/nps";

// Sem auth: página pública, respondida pelo cliente final (ver Etapa 27).
export async function submitNpsResponseAction(
  token: string,
  score: number,
  feedback: string
): Promise<NpsResponseResult> {
  return recordNpsResponse(token, score, feedback.trim() || null);
}

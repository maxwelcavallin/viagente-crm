"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/db";
import { emailSettings } from "@/db/schema";
import { encryptCredential } from "@/lib/credentials-crypto";

async function requireAdmin() {
  const session = await auth();
  return session?.user?.role === "admin";
}

export type SaveEmailSettingsState =
  | { status: "idle" }
  | { status: "error"; message: string };

const idle: SaveEmailSettingsState = { status: "idle" };

export async function saveEmailSettingsAction(
  _prevState: SaveEmailSettingsState,
  formData: FormData
): Promise<SaveEmailSettingsState> {
  if (!(await requireAdmin())) {
    return { status: "error", message: "Acesso negado." };
  }

  const fromAddress = formData.get("fromAddress");
  const fromName = formData.get("fromName");
  const provider = formData.get("provider");
  const apiKey = formData.get("apiKey");

  if (typeof fromAddress !== "string" || !fromAddress.trim()) {
    return { status: "error", message: "Endereço de envio é obrigatório." };
  }
  if (typeof fromName !== "string" || !fromName.trim()) {
    return { status: "error", message: "Nome do remetente é obrigatório." };
  }
  if (provider !== "resend" && provider !== "postmark" && provider !== "sendgrid") {
    return { status: "error", message: "Provedor inválido." };
  }

  const [existing] = await db.select({ id: emailSettings.id }).from(emailSettings).limit(1);

  if (!existing && (typeof apiKey !== "string" || !apiKey.trim())) {
    return { status: "error", message: "API key é obrigatória." };
  }

  const values: Partial<typeof emailSettings.$inferInsert> = {
    fromAddress: fromAddress.trim(),
    fromName: fromName.trim(),
    provider,
  };
  if (typeof apiKey === "string" && apiKey.trim()) {
    values.apiKey = encryptCredential(apiKey.trim());
  }

  if (existing) {
    await db.update(emailSettings).set(values).where(eq(emailSettings.id, existing.id));
  } else {
    await db.insert(emailSettings).values(values as typeof emailSettings.$inferInsert);
  }

  revalidatePath("/configuracoes/email");
  return idle;
}

"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/db";
import { leaddeltaSettings } from "@/db/schema";
import { encryptCredential } from "@/lib/credentials-crypto";

async function requireAdmin() {
  const session = await auth();
  return session?.user?.role === "admin";
}

export type SaveApiKeyState =
  | { status: "idle" }
  | { status: "error"; message: string };

const idle: SaveApiKeyState = { status: "idle" };

export async function saveApiKeyAction(
  _prevState: SaveApiKeyState,
  formData: FormData
): Promise<SaveApiKeyState> {
  if (!(await requireAdmin())) {
    return { status: "error", message: "Acesso negado." };
  }

  const apiKey = formData.get("apiKey");
  if (typeof apiKey !== "string" || !apiKey.trim()) {
    return { status: "error", message: "API Key é obrigatória." };
  }

  // Config única (1 registro só) — se já existe, atualiza; senão, cria.
  const [existing] = await db.select({ id: leaddeltaSettings.id }).from(leaddeltaSettings).limit(1);
  if (existing) {
    await db
      .update(leaddeltaSettings)
      .set({ apiKey: encryptCredential(apiKey.trim()) })
      .where(eq(leaddeltaSettings.id, existing.id));
  } else {
    await db.insert(leaddeltaSettings).values({ apiKey: encryptCredential(apiKey.trim()) });
  }

  revalidatePath("/configuracoes/linkedin");
  return idle;
}

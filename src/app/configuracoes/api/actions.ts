"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { createApiKey, setApiKeyActive, type ApiScope } from "@/lib/api-keys";

async function requireAdmin(): Promise<string | null> {
  const session = await auth();
  return session?.user?.role === "admin" ? session.user.id : null;
}

export type CreateApiKeyState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; label: string; rawKey: string };

export async function createApiKeyAction(
  _prevState: CreateApiKeyState,
  formData: FormData
): Promise<CreateApiKeyState> {
  const userId = await requireAdmin();
  if (!userId) return { status: "error", message: "Acesso negado." };

  const label = formData.get("label");
  if (typeof label !== "string" || !label.trim()) {
    return { status: "error", message: "Informe um nome/rótulo pra chave." };
  }

  const scope: ApiScope = formData.get("scope") === "admin" ? "admin" : "operacional";

  const { rawKey } = await createApiKey({
    label: label.trim(),
    scope,
    createdByUserId: userId,
  });

  revalidatePath("/configuracoes/api");
  return { status: "success", label: label.trim(), rawKey };
}

export async function toggleApiKeyActiveAction(
  id: string,
  active: boolean
): Promise<{ ok: boolean }> {
  const userId = await requireAdmin();
  if (!userId) return { ok: false };

  await setApiKeyActive(id, active);
  revalidatePath("/configuracoes/api");
  return { ok: true };
}

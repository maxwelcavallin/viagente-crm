"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { disconnectGoogleCalendar } from "@/lib/google-calendar";

export async function disconnectGoogleAction(): Promise<{ ok: boolean }> {
  const session = await auth();
  if (!session?.user) return { ok: false };

  await disconnectGoogleCalendar(session.user.id);
  return { ok: true };
}

// Chamado depois que o navegador já subiu o arquivo direto pro R2 (ver
// /api/avatars/upload-url) — só grava a referência no banco. Chave fixa por
// usuário, então não precisa de parâmetro nenhum aqui.
export async function updateAvatarAction(): Promise<{ ok: boolean }> {
  const session = await auth();
  if (!session?.user) return { ok: false };

  await db
    .update(users)
    .set({ avatarUrl: `/api/avatars/${session.user.id}` })
    .where(eq(users.id, session.user.id));

  revalidatePath("/perfil");
  return { ok: true };
}

export async function removeAvatarAction(): Promise<{ ok: boolean }> {
  const session = await auth();
  if (!session?.user) return { ok: false };

  await db.update(users).set({ avatarUrl: null }).where(eq(users.id, session.user.id));

  revalidatePath("/perfil");
  return { ok: true };
}

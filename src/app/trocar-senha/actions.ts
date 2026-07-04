"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { hashPassword } from "@/lib/password";

export type ChangePasswordState = {
  status: "idle" | "error";
  message?: string;
};

export async function changePasswordAction(
  _prevState: ChangePasswordState,
  formData: FormData
): Promise<ChangePasswordState> {
  const session = await auth();
  if (!session?.user) {
    return { status: "error", message: "Sessão expirada. Faça login novamente." };
  }

  const newPassword = formData.get("newPassword");
  const confirmPassword = formData.get("confirmPassword");

  if (
    typeof newPassword !== "string" ||
    typeof confirmPassword !== "string"
  ) {
    return { status: "error", message: "Preencha os dois campos." };
  }
  if (newPassword.length < 8) {
    return {
      status: "error",
      message: "A senha precisa ter pelo menos 8 caracteres.",
    };
  }
  if (newPassword !== confirmPassword) {
    return { status: "error", message: "As senhas não coincidem." };
  }

  const passwordHash = await hashPassword(newPassword);

  await db
    .update(users)
    .set({ passwordHash, mustChangePassword: false })
    .where(eq(users.id, session.user.id));

  // A sessão atual carrega mustChangePassword=true no JWT. Em vez de tentar
  // atualizar a sessão em memória no client (frágil nesse setup — chegou a
  // travar em teste), é mais simples e confiável forçar um novo login.
  // `signOut` com `redirectTo` faz seu próprio ciclo de redirect internamente,
  // que não chega no client como uma resposta de Server Action válida (erro
  // "An unexpected response was received from the server"). Por isso só
  // invalidamos a sessão aqui (redirect: false) e quem redireciona de fato é
  // o `redirect()` do Next, chamado diretamente por esta Server Action.
  await signOut({ redirect: false });
  redirect("/login");
}

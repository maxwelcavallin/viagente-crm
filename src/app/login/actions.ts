"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/auth";

// Só aceita caminho relativo de dentro do próprio app (nunca "//host" nem
// URL absoluta) — evita virar um open redirect a partir do query param.
function safeCallbackUrl(value: FormDataEntryValue | null): string {
  if (typeof value === "string" && /^\/(?!\/)/.test(value)) return value;
  return "/";
}

export async function loginAction(
  _prevState: string | undefined,
  formData: FormData
) {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: safeCallbackUrl(formData.get("callbackUrl")),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return "Email ou senha incorretos.";
    }
    throw error;
  }
}

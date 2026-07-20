"use server";

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import type { ApiScope } from "@/lib/api-keys";
import { createAuthorizationCode, getOAuthClient } from "@/lib/mcp-oauth";

function redirectWithError(redirectUri: string, state: string | null, error: string): never {
  const url = new URL(redirectUri);
  url.searchParams.set("error", error);
  if (state) url.searchParams.set("state", state);
  redirect(url.toString());
}

export async function authorizeConsentAction(formData: FormData): Promise<void> {
  const clientId = formData.get("client_id");
  const redirectUri = formData.get("redirect_uri");
  const codeChallenge = formData.get("code_challenge");
  const state = (formData.get("state") as string | null) ?? null;
  const scope = formData.get("scope");

  if (
    typeof clientId !== "string" ||
    typeof redirectUri !== "string" ||
    typeof codeChallenge !== "string" ||
    typeof scope !== "string"
  ) {
    throw new Error("Formulário de autorização OAuth incompleto.");
  }

  if (scope === "cancel") {
    redirectWithError(redirectUri, state, "access_denied");
  }

  if (scope !== "operacional" && scope !== "admin") {
    redirectWithError(redirectUri, state, "invalid_request");
  }

  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    redirectWithError(redirectUri, state, "access_denied");
  }

  // Revalida client_id/redirect_uri no server action — os hidden inputs do
  // form vieram do cliente, não confiar só na validação já feita ao
  // renderizar a página.
  const client = await getOAuthClient(clientId);
  if (!client || !client.redirectUris.includes(redirectUri)) {
    redirectWithError(redirectUri, state, "invalid_request");
  }

  const code = await createAuthorizationCode({
    clientId,
    userId: session.user.id,
    redirectUri,
    codeChallenge,
    scope: scope as ApiScope,
  });

  const url = new URL(redirectUri);
  url.searchParams.set("code", code);
  if (state) url.searchParams.set("state", state);
  redirect(url.toString());
}

import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { instagramChannels } from "@/db/schema";
import { encryptCredential } from "@/lib/credentials-crypto";
import {
  exchangeCodeForUserToken,
  exchangeForLongLivedToken,
  getInstagramUsername,
} from "@/lib/instagram-graph";

export const dynamic = "force-dynamic";

function redirectToSettings(request: Request, error?: string): Response {
  const url = new URL("/configuracoes/instagram", request.url);
  if (error) url.searchParams.set("error", error);
  return Response.redirect(url, 302);
}

function callbackUrl(request: Request): string {
  return new URL("/api/instagram/oauth/callback", request.url).toString();
}

// Recebe o retorno do dialog OAuth do Instagram (iniciado em
// /configuracoes/instagram) — troca o code por um token de usuário
// (já vem com o instagramUserId direto), troca por um token de longa
// duração (60 dias) e grava/atualiza o canal. Sem Página do Facebook
// envolvida (Instagram API with Instagram Login).
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return Response.redirect(new URL("/login", request.url), 302);
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const oauthError = url.searchParams.get("error");
  if (oauthError || !code) {
    return redirectToSettings(request, oauthError ?? "sem_code");
  }

  try {
    const { accessToken: shortLivedToken, instagramUserId } = await exchangeCodeForUserToken(
      code,
      callbackUrl(request)
    );
    const { accessToken, expiresAt } = await exchangeForLongLivedToken(shortLivedToken);
    const username = await getInstagramUsername(accessToken).catch(() => null);

    const values = {
      label: username ? `@${username}` : instagramUserId,
      username,
      instagramUserId,
      accessToken: encryptCredential(accessToken),
      tokenExpiresAt: expiresAt,
      status: "conectado" as const,
    };

    const [existing] = await db
      .select({ id: instagramChannels.id })
      .from(instagramChannels)
      .where(eq(instagramChannels.instagramUserId, instagramUserId))
      .limit(1);

    if (existing) {
      await db.update(instagramChannels).set(values).where(eq(instagramChannels.id, existing.id));
    } else {
      await db.insert(instagramChannels).values(values);
    }

    return redirectToSettings(request);
  } catch (error) {
    console.error("[instagram oauth callback] falha ao conectar conta", error);
    return redirectToSettings(request, "falha_conexao");
  }
}

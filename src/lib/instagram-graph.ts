import { eq, lt } from "drizzle-orm";
import { db } from "@/db";
import { instagramChannels } from "@/db/schema";
import { decryptCredential, encryptCredential } from "@/lib/credentials-crypto";

// Cliente pro "Instagram API with Instagram Login" (Business Login for
// Instagram), confirmado na documentação oficial em 2026-07:
// developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/.
// Diferente da API com Facebook Login: login direto na conta profissional
// do Instagram, sem precisar de Página do Facebook vinculada — o token já é
// tudo que se precisa, sem token de Página separado.
// - dialog OAuth: GET https://www.instagram.com/oauth/authorize
// - troca de code por token curto: POST https://api.instagram.com/oauth/access_token
//   (retorna access_token + user_id direto, sem precisar de outra chamada)
// - troca por token de longa duração (60 dias): GET https://graph.instagram.com/access_token
//   (grant_type=ig_exchange_token)
// - renovação (token com >24h e ainda não expirado): GET
//   https://graph.instagram.com/refresh_access_token (grant_type=ig_refresh_token)
// - dados da conta: GET https://graph.instagram.com/{v}/me?fields=username
// - enviar texto: POST https://graph.instagram.com/{v}/me/messages, mesmo
//   body de antes ({ recipient: { id }, message: { text } }), só que com o
//   token da própria conta Instagram, não mais token de Página.

const GRAPH_API_VERSION = "v21.0";
const GRAPH_BASE = `https://graph.instagram.com/${GRAPH_API_VERSION}`;
const CODE_EXCHANGE_URL = "https://api.instagram.com/oauth/access_token";
const AUTHORIZE_URL = "https://www.instagram.com/oauth/authorize";

// Escopo mínimo pro que este CRM usa (mensagens de atendimento) — não pede
// instagram_business_manage_comments nem instagram_business_content_publish,
// que não são usados aqui.
const REQUIRED_SCOPES = ["instagram_business_basic", "instagram_business_manage_messages"];

// Renova o token quando faltar menos que isso pro vencimento (token de 60
// dias) — cron diário de sobra de margem pra nunca deixar expirar de fato.
const REFRESH_BUFFER_DAYS = 10;

function requireAppId(): string {
  const appId = process.env.INSTAGRAM_APP_ID;
  if (!appId) throw new Error("INSTAGRAM_APP_ID não configurado");
  return appId;
}

function requireAppSecret(): string {
  const secret = process.env.INSTAGRAM_APP_SECRET;
  if (!secret) throw new Error("INSTAGRAM_APP_SECRET não configurado");
  return secret;
}

export function getInstagramAuthorizeUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: requireAppId(),
    redirect_uri: redirectUri,
    response_type: "code",
    scope: REQUIRED_SCOPES.join(","),
    state,
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

export type CodeExchangeResult = { accessToken: string; instagramUserId: string };

export async function exchangeCodeForUserToken(
  code: string,
  redirectUri: string
): Promise<CodeExchangeResult> {
  const res = await fetch(CODE_EXCHANGE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: requireAppId(),
      client_secret: requireAppSecret(),
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
      code,
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Falha ao trocar code por token (status ${res.status}): ${text}`);
  }
  const data = (await res.json()) as { access_token?: string; user_id?: string | number };
  if (!data.access_token || data.user_id == null) {
    throw new Error("Instagram não retornou access_token/user_id");
  }
  return { accessToken: data.access_token, instagramUserId: String(data.user_id) };
}

export type LongLivedTokenResult = { accessToken: string; expiresAt: Date };

async function graphInstagramGet<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = `${path}?${new URLSearchParams(params).toString()}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Instagram Graph API respondeu ${res.status} em ${path}: ${text}`);
  }
  return (await res.json()) as T;
}

export async function exchangeForLongLivedToken(
  shortLivedToken: string
): Promise<LongLivedTokenResult> {
  const data = await graphInstagramGet<{ access_token?: string; expires_in?: number }>(
    "https://graph.instagram.com/access_token",
    {
      grant_type: "ig_exchange_token",
      client_secret: requireAppSecret(),
      access_token: shortLivedToken,
    }
  );
  if (!data.access_token || !data.expires_in) {
    throw new Error("Instagram não retornou access_token de longa duração");
  }
  return { accessToken: data.access_token, expiresAt: new Date(Date.now() + data.expires_in * 1000) };
}

async function refreshLongLivedToken(token: string): Promise<LongLivedTokenResult> {
  const data = await graphInstagramGet<{ access_token?: string; expires_in?: number }>(
    "https://graph.instagram.com/refresh_access_token",
    { grant_type: "ig_refresh_token", access_token: token }
  );
  if (!data.access_token || !data.expires_in) {
    throw new Error("Instagram não retornou access_token renovado");
  }
  return { accessToken: data.access_token, expiresAt: new Date(Date.now() + data.expires_in * 1000) };
}

// Só busca o username (a conta em si — instagramUserId — já veio direto da
// troca do code, sem precisar de outra chamada pra descobrir).
export async function getInstagramUsername(accessToken: string): Promise<string | null> {
  const data = await graphInstagramGet<{ username?: string }>(`${GRAPH_BASE}/me`, {
    fields: "username",
    access_token: accessToken,
  });
  return data.username ?? null;
}

export async function sendInstagramText(
  accessToken: string,
  recipientIgsid: string,
  text: string
): Promise<{ messageId: string }> {
  const url = `${GRAPH_BASE}/me/messages?${new URLSearchParams({ access_token: accessToken }).toString()}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ recipient: { id: recipientIgsid }, message: { text } }),
    cache: "no-store",
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Falha ao enviar mensagem via Instagram (status ${res.status}): ${errText}`);
  }

  const data = (await res.json()) as { message_id?: string };
  if (!data.message_id) {
    throw new Error("Graph API não retornou message_id na resposta de envio");
  }
  return { messageId: data.message_id };
}

// Perfil de quem mandou a mensagem — o payload do webhook só traz o IGSID,
// sem nome/foto, então isso é uma chamada extra (só feita ao criar um
// contato novo, ver /api/instagram/webhook). Retorna null em qualquer falha,
// mesmo padrão de melhor esforço de getZapiProfilePicture.
export async function getInstagramUserProfile(
  accessToken: string,
  igsid: string
): Promise<{ name: string | null; profilePic: string | null } | null> {
  try {
    const data = await graphInstagramGet<{ name?: string; profile_pic?: string }>(
      `${GRAPH_BASE}/${igsid}`,
      { fields: "name,profile_pic", access_token: accessToken }
    );
    return { name: data.name ?? null, profilePic: data.profile_pic ?? null };
  } catch {
    return null;
  }
}

// Valida o token fazendo uma chamada leve — usado pelo "Testar conexão" da
// página de configurações, mesmo padrão de checkZapiStatus. Consulta /me,
// não /{instagramUserId}: no Instagram API with Instagram Login, buscar a
// própria conta por id direto responde 400 ("does not exist... ou não
// suporta essa operação") mesmo com token e permissões corretos — /me é o
// jeito documentado de ler dados da conta dona do token.
export async function checkInstagramStatus(
  accessToken: string
): Promise<{ connected: boolean; error?: string }> {
  try {
    await graphInstagramGet<{ id?: string }>(`${GRAPH_BASE}/me`, {
      fields: "id",
      access_token: accessToken,
    });
    return { connected: true };
  } catch (error) {
    return {
      connected: false,
      error: error instanceof Error ? error.message : "Erro desconhecido",
    };
  }
}

// Varredura diária (chamada pelo cron de task-automation, mesmo padrão dos
// demais "sweeps" bundlados ali): renova todo token que esteja perto do
// vencimento. Token de 60 dias exige >24h desde a última renovação — nunca
// é um problema aqui, já que só renovamos com dias de folga.
export async function refreshExpiringInstagramTokens(): Promise<{ refreshed: number; errors: number }> {
  const threshold = new Date(Date.now() + REFRESH_BUFFER_DAYS * 24 * 60 * 60 * 1000);
  const channels = await db
    .select({ id: instagramChannels.id, accessToken: instagramChannels.accessToken })
    .from(instagramChannels)
    .where(lt(instagramChannels.tokenExpiresAt, threshold));

  let refreshed = 0;
  let errors = 0;
  for (const channel of channels) {
    try {
      const { accessToken, expiresAt } = await refreshLongLivedToken(
        decryptCredential(channel.accessToken)
      );
      await db
        .update(instagramChannels)
        .set({ accessToken: encryptCredential(accessToken), tokenExpiresAt: expiresAt })
        .where(eq(instagramChannels.id, channel.id));
      refreshed++;
    } catch (error) {
      console.error("[instagram-graph] falha ao renovar token", channel.id, error);
      errors++;
    }
  }
  return { refreshed, errors };
}

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

// O user_id devolvido aqui é DELIBERADAMENTE ignorado — confirmado contra
// payload real de webhook que esse valor não é o mesmo usado em
// recipient.id/sender.id das mensagens (namespace de ID diferente; ver
// getInstagramAccountInfo). Também vem como número cru no JSON dessa
// resposta, arriscando perda de precisão em process.json() pra IDs de 17+
// dígitos — mais uma razão pra nunca confiar nesse campo.
export async function exchangeCodeForUserToken(code: string, redirectUri: string): Promise<{ accessToken: string }> {
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
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) {
    throw new Error("Instagram não retornou access_token");
  }
  return { accessToken: data.access_token };
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

export type InstagramAccountInfo = { userId: string; username: string | null };

// Fonte da verdade pro instagramUserId salvo no canal — NÃO usar o user_id
// devolvido pela troca do code (api.instagram.com/oauth/access_token):
// confirmado contra um payload real de webhook que esse valor pertence a um
// namespace de ID diferente do usado em recipient.id/sender.id das
// mensagens (e do usado na Conversations API). O campo `user_id` de
// GET /me (graph.instagram.com) é o que bate com o webhook; o campo `id`
// do mesmo /me é ainda um terceiro valor, também não usado aqui.
export async function getInstagramAccountInfo(accessToken: string): Promise<InstagramAccountInfo> {
  const data = await graphInstagramGet<{ user_id?: string; username?: string }>(`${GRAPH_BASE}/me`, {
    fields: "user_id,username",
    access_token: accessToken,
  });
  if (!data.user_id) throw new Error("Instagram não retornou user_id em /me");
  return { userId: data.user_id, username: data.username ?? null };
}

// Passo obrigatório e separado da configuração da URL de webhook no painel
// do app — sem essa chamada, a conta fica com token válido mas o Meta nunca
// dispara nenhum evento pra ela (nenhum POST chega, só o handshake de
// verificação da URL em si). Precisa ser feita uma vez por conta conectada.
export async function subscribeInstagramWebhook(accessToken: string): Promise<void> {
  const url = `${GRAPH_BASE}/me/subscribed_apps?${new URLSearchParams({
    subscribed_fields: "messages",
    access_token: accessToken,
  }).toString()}`;
  const res = await fetch(url, { method: "POST", cache: "no-store" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Falha ao inscrever webhook do Instagram (status ${res.status}): ${text}`);
  }
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

// Envia mídia via anexo por URL (Meta busca o arquivo na url informada) —
// mesmo padrão de mediaUrl assinada já usado pra Z-API. Só image/video/audio:
// a Messaging API do Instagram não tem um tipo "document" genérico (ver
// developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/messaging).
export async function sendInstagramAttachment(
  accessToken: string,
  recipientIgsid: string,
  type: "image" | "video" | "audio",
  mediaUrl: string
): Promise<{ messageId: string }> {
  const url = `${GRAPH_BASE}/me/messages?${new URLSearchParams({ access_token: accessToken }).toString()}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recipient: { id: recipientIgsid },
      message: { attachment: { type, payload: { url: mediaUrl } } },
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Falha ao enviar mídia via Instagram (status ${res.status}): ${errText}`);
  }

  const data = (await res.json()) as { message_id?: string };
  if (!data.message_id) {
    throw new Error("Graph API não retornou message_id na resposta de envio de mídia");
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
): Promise<{ name: string | null; profilePic: string | null; username: string | null } | null> {
  try {
    const data = await graphInstagramGet<{ name?: string; profile_pic?: string; username?: string }>(
      `${GRAPH_BASE}/${igsid}`,
      { fields: "name,profile_pic,username", access_token: accessToken }
    );
    return {
      name: data.name ?? null,
      profilePic: data.profile_pic ?? null,
      username: data.username ?? null,
    };
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

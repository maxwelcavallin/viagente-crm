import { eq } from "drizzle-orm";
import { db } from "@/db";
import { googleCalendarConnections, googleCalendarShares } from "@/db/schema";
import { decryptCredential, encryptCredential } from "@/lib/credentials-crypto";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";
// drive.readonly foi adicionado na Etapa 31 (ler os docs de notas do Gemini
// anexados aos eventos) — usuários que conectaram antes disso precisam
// reconectar (prompt=consent abaixo já força nova concessão de escopo a
// cada conexão).
const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/drive.readonly",
];
const TIME_ZONE = "America/Sao_Paulo";
// Margem de segurança antes do vencimento real — evita usar um token que
// expira no meio da chamada por causa de latência de rede.
const EXPIRY_BUFFER_MS = 60_000;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} não está definida`);
  return value;
}

export function getGoogleAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: requireEnv("GOOGLE_CLIENT_ID"),
    redirect_uri: requireEnv("GOOGLE_OAUTH_REDIRECT_URI"),
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

type TokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
};

export async function exchangeCodeForTokens(
  code: string
): Promise<{ accessToken: string; refreshToken: string; expiresAt: Date }> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: requireEnv("GOOGLE_CLIENT_ID"),
      client_secret: requireEnv("GOOGLE_CLIENT_SECRET"),
      redirect_uri: requireEnv("GOOGLE_OAUTH_REDIRECT_URI"),
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Falha ao trocar code por token (status ${res.status}): ${text}`);
  }
  const data = (await res.json()) as TokenResponse;
  if (!data.refresh_token) {
    throw new Error(
      "Google não retornou refresh_token — reconecte com prompt=consent (já deveria estar garantido)."
    );
  }
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  };
}

async function refreshAccessToken(
  refreshToken: string
): Promise<{ accessToken: string; expiresAt: Date }> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: requireEnv("GOOGLE_CLIENT_ID"),
      client_secret: requireEnv("GOOGLE_CLIENT_SECRET"),
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    // invalid_grant costuma significar que o usuário revogou o acesso.
    throw new Error(`Falha ao renovar access_token (status ${res.status}): ${text}`);
  }
  const data = (await res.json()) as TokenResponse;
  return {
    accessToken: data.access_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  };
}

// Resolve de quem é a conexão Google que `schedulingUserId` deve usar: a
// própria, se existir; senão a de um admin que compartilhou com ele; senão
// null (sem conexão disponível — chamador deve cair no fallback de link).
export async function resolveConnectionOwner(
  schedulingUserId: string
): Promise<string | null> {
  const [own] = await db
    .select({ userId: googleCalendarConnections.userId })
    .from(googleCalendarConnections)
    .where(eq(googleCalendarConnections.userId, schedulingUserId))
    .limit(1);
  if (own) return own.userId;

  const [shared] = await db
    .select({ ownerUserId: googleCalendarShares.ownerUserId })
    .from(googleCalendarShares)
    .where(eq(googleCalendarShares.sharedWithUserId, schedulingUserId))
    .limit(1);
  return shared?.ownerUserId ?? null;
}

// Retorna um access_token válido pro dono da conexão, renovando via
// refresh_token e persistindo o novo valor (criptografado) se necessário.
export async function getValidAccessToken(ownerUserId: string): Promise<string> {
  const [connection] = await db
    .select()
    .from(googleCalendarConnections)
    .where(eq(googleCalendarConnections.userId, ownerUserId))
    .limit(1);
  if (!connection) {
    throw new Error("Nenhuma conexão com o Google Agenda encontrada para este usuário.");
  }

  const stillValid =
    connection.accessToken &&
    connection.tokenExpiry &&
    connection.tokenExpiry.getTime() - EXPIRY_BUFFER_MS > Date.now();
  if (stillValid) {
    return decryptCredential(connection.accessToken!);
  }

  const refreshToken = decryptCredential(connection.refreshToken);
  const { accessToken, expiresAt } = await refreshAccessToken(refreshToken);

  await db
    .update(googleCalendarConnections)
    .set({
      accessToken: encryptCredential(accessToken),
      tokenExpiry: expiresAt,
    })
    .where(eq(googleCalendarConnections.userId, ownerUserId));

  return accessToken;
}

export async function saveGoogleCalendarConnection(params: {
  userId: string;
  refreshToken: string;
  accessToken: string;
  expiresAt: Date;
}): Promise<void> {
  await db
    .insert(googleCalendarConnections)
    .values({
      userId: params.userId,
      refreshToken: encryptCredential(params.refreshToken),
      accessToken: encryptCredential(params.accessToken),
      tokenExpiry: params.expiresAt,
    })
    .onConflictDoUpdate({
      target: googleCalendarConnections.userId,
      set: {
        refreshToken: encryptCredential(params.refreshToken),
        accessToken: encryptCredential(params.accessToken),
        tokenExpiry: params.expiresAt,
        connectedAt: new Date(),
      },
    });
}

export async function disconnectGoogleCalendar(userId: string): Promise<void> {
  const [connection] = await db
    .select({ refreshToken: googleCalendarConnections.refreshToken })
    .from(googleCalendarConnections)
    .where(eq(googleCalendarConnections.userId, userId))
    .limit(1);

  if (connection) {
    try {
      await fetch(`${REVOKE_URL}?token=${encodeURIComponent(decryptCredential(connection.refreshToken))}`, {
        method: "POST",
      });
    } catch {
      // Revogar é best-effort — a desconexão local não pode ficar presa a
      // uma chamada de rede pro Google que pode falhar por vários motivos.
    }
  }

  await db.delete(googleCalendarConnections).where(eq(googleCalendarConnections.userId, userId));
}

export type CreateCalendarEventParams = {
  title: string;
  description: string;
  startAt: Date;
  endAt: Date;
  attendeeEmail?: string | null;
};

export type CreateCalendarEventResult = { id: string; htmlLink: string };

export async function createCalendarEvent(
  schedulingUserId: string,
  params: CreateCalendarEventParams
): Promise<CreateCalendarEventResult> {
  const ownerUserId = await resolveConnectionOwner(schedulingUserId);
  if (!ownerUserId) {
    throw new Error("NOT_CONNECTED");
  }

  const [connection] = await db
    .select({ calendarId: googleCalendarConnections.calendarId })
    .from(googleCalendarConnections)
    .where(eq(googleCalendarConnections.userId, ownerUserId))
    .limit(1);
  const calendarId = connection?.calendarId ?? "primary";

  const accessToken = await getValidAccessToken(ownerUserId);

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?sendUpdates=all`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        summary: params.title,
        description: params.description,
        start: { dateTime: params.startAt.toISOString(), timeZone: TIME_ZONE },
        end: { dateTime: params.endAt.toISOString(), timeZone: TIME_ZONE },
        attendees: params.attendeeEmail ? [{ email: params.attendeeEmail }] : undefined,
      }),
    }
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("[google-calendar] falha ao criar evento", res.status, text);
    throw new Error(`GOOGLE_API_ERROR: ${res.status}`);
  }

  const data = (await res.json()) as { id: string; htmlLink: string };
  return { id: data.id, htmlLink: data.htmlLink };
}

export type CalendarEventAttachment = {
  fileId: string;
  fileUrl: string;
  title: string;
  mimeType: string;
};

export type CalendarEvent = {
  id: string;
  summary?: string;
  start?: { dateTime?: string; date?: string };
  attendees?: { email: string }[];
  attachments?: CalendarEventAttachment[];
};

// Lista eventos de um usuário conectado num intervalo de datas, paginando
// até esgotar (Etapa 31 — sincronização de notas do Gemini). `attachments`
// e `attendees` já vêm por padrão na representação completa do evento, sem
// precisar de nenhum parâmetro extra na query. `q` (busca livre da API do
// Google, cobre título/descrição/local/nome e email de convidado e
// organizador) filtra server-side — usado pela sincronização manual por
// negócio (ver syncMeetingNotesForDeal) pra buscar só os eventos com aquele
// email, em vez de trazer o intervalo inteiro como a varredura do cron faz.
export async function listCalendarEvents(
  ownerUserId: string,
  params: { timeMin: Date; timeMax: Date; q?: string }
): Promise<CalendarEvent[]> {
  const [connection] = await db
    .select({ calendarId: googleCalendarConnections.calendarId })
    .from(googleCalendarConnections)
    .where(eq(googleCalendarConnections.userId, ownerUserId))
    .limit(1);
  if (!connection) throw new Error("NOT_CONNECTED");

  const accessToken = await getValidAccessToken(ownerUserId);
  const events: CalendarEvent[] = [];
  let pageToken: string | undefined;

  do {
    const query = new URLSearchParams({
      timeMin: params.timeMin.toISOString(),
      timeMax: params.timeMax.toISOString(),
      singleEvents: "true",
      orderBy: "startTime",
    });
    if (params.q) query.set("q", params.q);
    if (pageToken) query.set("pageToken", pageToken);

    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(connection.calendarId)}/events?${query.toString()}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("[google-calendar] falha ao listar eventos", res.status, text);
      throw new Error(`GOOGLE_API_ERROR: ${res.status}`);
    }

    const data = (await res.json()) as { items?: CalendarEvent[]; nextPageToken?: string };
    events.push(...(data.items ?? []));
    pageToken = data.nextPageToken;
  } while (pageToken);

  return events;
}

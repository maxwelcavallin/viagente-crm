import { eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { contacts, deals, googleCalendarConnections, meetingNotes, meetingNotesContacts } from "@/db/schema";
import {
  getValidAccessToken,
  listCalendarEvents,
  type CalendarEvent,
  type CalendarEventAttachment,
} from "@/lib/google-calendar";
import { fetchDriveFileText } from "@/lib/google-drive";
import { parseGeminiNotesDoc, TRANSCRIPT_TITLE_SUFFIX } from "@/lib/meeting-notes-parser";
import { findOpenDealIdForContact } from "@/lib/messaging";

const LOOKBACK_DAYS = 14;
const GOOGLE_DOC_MIME_TYPE = "application/vnd.google-apps.document";

type SyncOutcome = "created" | "skipped";

function classifyDocs(
  attachments: CalendarEventAttachment[] | undefined,
  eventTitle: string
): { notesDoc: CalendarEventAttachment | null; transcriptDoc: CalendarEventAttachment | null } {
  const docs = (attachments ?? []).filter((a) => a.mimeType === GOOGLE_DOC_MIME_TYPE);
  const transcriptDoc = docs.find((d) => TRANSCRIPT_TITLE_SUFFIX.test(d.title.trim())) ?? null;
  const remaining = docs.filter((d) => d !== transcriptDoc);
  // Título do doc de notas bate com o título do evento (achado do exemplo
  // real calibrado nesta etapa) — se não bater com nenhum e sobrar só um
  // anexo Docs isolado, ainda tentamos como candidato: o próprio parser
  // decide via parsedOk se o conteúdo realmente é nota do Gemini.
  const notesDoc =
    remaining.find((d) => eventTitle && d.title.trim() === eventTitle) ??
    (remaining.length === 1 ? remaining[0] : null);
  return { notesDoc, transcriptDoc };
}

async function syncEvent(crmUserId: string, event: CalendarEvent): Promise<SyncOutcome> {
  const eventTitle = (event.summary ?? "").trim();
  const { notesDoc, transcriptDoc } = classifyDocs(event.attachments, eventTitle);
  if (!notesDoc) return "skipped";

  const [existing] = await db
    .select({ id: meetingNotes.id })
    .from(meetingNotes)
    .where(eq(meetingNotes.driveFileId, notesDoc.fileId))
    .limit(1);
  if (existing) return "skipped";

  const attendeeEmails = (event.attendees ?? [])
    .map((a) => a.email?.toLowerCase().trim())
    .filter((email): email is string => Boolean(email));
  if (attendeeEmails.length === 0) return "skipped";

  const matchedContacts = await db
    .select({ id: contacts.id })
    .from(contacts)
    .where(inArray(sql`lower(${contacts.email})`, attendeeEmails));
  if (matchedContacts.length === 0) return "skipped";

  const accessToken = await getValidAccessToken(crmUserId);
  const notesText = await fetchDriveFileText(accessToken, notesDoc.fileId);
  const transcriptText = transcriptDoc
    ? await fetchDriveFileText(accessToken, transcriptDoc.fileId)
    : undefined;

  const parsed = parseGeminiNotesDoc(notesText, transcriptText);
  const meetingDate = event.start?.dateTime
    ? new Date(event.start.dateTime)
    : event.start?.date
      ? new Date(event.start.date)
      : new Date();

  const [created] = await db
    .insert(meetingNotes)
    .values({
      googleEventId: event.id,
      crmUserId,
      driveFileId: notesDoc.fileId,
      driveFileUrl: notesDoc.fileUrl,
      title: eventTitle || notesDoc.title,
      meetingDate,
      attendeeEmails,
      summary: parsed.summary,
      transcript: parsed.transcript,
      actionItems: parsed.actionItems,
      parsedOk: parsed.parsedOk,
    })
    .onConflictDoNothing({ target: meetingNotes.driveFileId })
    .returning({ id: meetingNotes.id });
  // onConflictDoNothing pode não retornar nada se outra conexão inseriu o
  // mesmo evento entre o check acima e este insert — tratamos como já
  // sincronizado, não como erro.
  if (!created) return "skipped";

  for (const contact of matchedContacts) {
    const dealId = await findOpenDealIdForContact(contact.id);
    await db
      .insert(meetingNotesContacts)
      .values({ meetingNoteId: created.id, contactId: contact.id, dealId })
      .onConflictDoNothing();
  }

  return "created";
}

export type MeetingNotesSyncResult = {
  connections: number;
  eventsProcessed: number;
  created: number;
  skipped: number;
  errors: number;
};

// Varredura diária (ver vercel.json + /api/cron/sync-meeting-notes): pra
// cada conexão de Google Agenda ativa, lista os eventos dos últimos 14
// dias e sincroniza os que têm nota do Gemini com convidado reconhecido.
// Erro numa conexão (token sem escopo Drive, revogado, etc.) ou num evento
// específico não aborta a varredura inteira — mesmo idioma de tolerância a
// falha por item do runNpsSweep (src/lib/nps.ts).
export async function runMeetingNotesSync(): Promise<MeetingNotesSyncResult> {
  const connections = await db.select({ userId: googleCalendarConnections.userId }).from(googleCalendarConnections);

  const timeMax = new Date();
  const timeMin = new Date(timeMax.getTime() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);

  let eventsProcessed = 0;
  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const connection of connections) {
    let events: CalendarEvent[];
    try {
      events = await listCalendarEvents(connection.userId, { timeMin, timeMax });
    } catch (error) {
      console.error("[meeting-notes-sync] falha ao listar eventos", connection.userId, error);
      errors++;
      continue;
    }

    for (const event of events) {
      eventsProcessed++;
      try {
        const outcome = await syncEvent(connection.userId, event);
        if (outcome === "created") created++;
        else skipped++;
      } catch (error) {
        console.error("[meeting-notes-sync] falha ao processar evento", event.id, error);
        errors++;
      }
    }
  }

  return { connections: connections.length, eventsProcessed, created, skipped, errors };
}

export type SyncMeetingNotesForDealResult =
  | { ok: true; created: number; skipped: number }
  | { ok: false; error: string };

// Botão "Sincronizar reuniões" da página do negócio — alimenta as notas
// exatamente como a varredura do cron (mesma syncEvent, mesma janela de
// LOOKBACK_DAYS), mas nunca varre o intervalo inteiro de cada conexão: passa
// o email do contato como busca (`q`) pro Google já filtrar server-side (ver
// listCalendarEvents), então só os eventos que de fato mencionam esse email
// voltam — evita a sobrecarga de listar/paginar todo o calendário de cada
// conexão numa ação manual disparada a qualquer momento.
export async function syncMeetingNotesForDeal(
  dealId: string
): Promise<SyncMeetingNotesForDealResult> {
  const [deal] = await db
    .select({ contactId: deals.contactId })
    .from(deals)
    .where(eq(deals.id, dealId))
    .limit(1);
  if (!deal) return { ok: false, error: "Negócio não encontrado." };

  const [contact] = await db
    .select({ email: contacts.email })
    .from(contacts)
    .where(eq(contacts.id, deal.contactId))
    .limit(1);
  if (!contact?.email) {
    return {
      ok: false,
      error: "O contato deste negócio não tem email cadastrado — a busca de reuniões usa o email como filtro.",
    };
  }

  const connections = await db.select({ userId: googleCalendarConnections.userId }).from(googleCalendarConnections);
  if (connections.length === 0) {
    return { ok: false, error: "Nenhuma conexão com o Google Agenda configurada." };
  }

  const timeMax = new Date();
  const timeMin = new Date(timeMax.getTime() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);

  let created = 0;
  let skipped = 0;
  for (const connection of connections) {
    let events: CalendarEvent[];
    try {
      events = await listCalendarEvents(connection.userId, { timeMin, timeMax, q: contact.email });
    } catch (error) {
      console.error("[meeting-notes-sync] falha ao listar eventos (sincronização por negócio)", connection.userId, error);
      continue;
    }

    for (const event of events) {
      try {
        const outcome = await syncEvent(connection.userId, event);
        if (outcome === "created") created++;
        else skipped++;
      } catch (error) {
        console.error("[meeting-notes-sync] falha ao processar evento (sincronização por negócio)", event.id, error);
      }
    }
  }

  return { ok: true, created, skipped };
}

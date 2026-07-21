import { and, eq, ne, or } from "drizzle-orm";
import { db } from "@/db";
import {
  contacts,
  contactTags,
  deals,
  emailsSent,
  meetingNotesContacts,
  messages,
  notifications,
  npsSurveys,
  scheduledMessages,
} from "@/db/schema";

export type MergeContactResult = { ok: true } | { ok: false; error: string };

export type DuplicateContactMatch = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  matchedField: "telefone" | "email";
};

// Detecta se telefone e/ou email já pertence a OUTRO contato — usado antes
// de criar/editar um contato (manual ou importação CSV) pra nunca deixar
// entrar um duplicado: "o sistema não deve permitir contatos com o mesmo
// telefone ou email já existente" (decisão explícita do usuário). Telefone
// é checado primeiro (é a identidade mais forte no CRM — WhatsApp já
// dedupa por ele), email depois.
export async function findDuplicateContact(
  phone: string | null,
  email: string | null,
  excludeId?: string
): Promise<DuplicateContactMatch | null> {
  if (!phone && !email) return null;

  const conditions = [];
  if (phone) conditions.push(eq(contacts.phone, phone));
  if (email) conditions.push(eq(contacts.email, email));

  const [match] = await db
    .select({ id: contacts.id, name: contacts.name, phone: contacts.phone, email: contacts.email })
    .from(contacts)
    .where(
      and(
        or(...conditions),
        excludeId ? ne(contacts.id, excludeId) : undefined
      )
    )
    .limit(1);
  if (!match) return null;

  return {
    ...match,
    matchedField: phone && match.phone === phone ? "telefone" : "email",
  };
}

// Reatribui pro destino tudo que referencia o contato de origem (mensagens,
// negócios, tags, agendamentos, emails, notificações, NPS, notas de
// reunião) e por fim apaga a origem — núcleo compartilhado por todo fluxo
// de merge de contato (Instagram vinculado, ou duplicata por telefone/email
// encontrada na edição manual). Não mexe em nenhum campo de identidade do
// contato (telefone/email/instagram/avatar) — quem chama decide isso.
//
// Não roda em transação — o driver neon-http não suporta (ver src/db/index.ts:
// drizzle-orm/neon-http lança "No transactions support..."). A ordem das
// operações é escolhida pra que uma falha no meio do caminho nunca perca
// dado: tudo é reatribuído ANTES de apagar a origem, que só acontece depois
// de não ter mais nenhuma relação pendente.
async function reassignContactRelations(
  sourceContactId: string,
  targetContactId: string
): Promise<void> {
  // Tags e notas de reunião têm chave única composta com contactId — copia
  // pro destino só o que ele ainda não tem (onConflictDoNothing cobre
  // sobreposição); as linhas antigas da origem somem no cascade do delete
  // final, já duplicadas.
  const sourceTags = await db
    .select({ tagId: contactTags.tagId })
    .from(contactTags)
    .where(eq(contactTags.contactId, sourceContactId));
  if (sourceTags.length > 0) {
    await db
      .insert(contactTags)
      .values(sourceTags.map((t) => ({ contactId: targetContactId, tagId: t.tagId })))
      .onConflictDoNothing();
  }

  const sourceMeetingNotes = await db
    .select({
      meetingNoteId: meetingNotesContacts.meetingNoteId,
      dealId: meetingNotesContacts.dealId,
    })
    .from(meetingNotesContacts)
    .where(eq(meetingNotesContacts.contactId, sourceContactId));
  if (sourceMeetingNotes.length > 0) {
    await db
      .insert(meetingNotesContacts)
      .values(
        sourceMeetingNotes.map((m) => ({
          meetingNoteId: m.meetingNoteId,
          contactId: targetContactId,
          dealId: m.dealId,
        }))
      )
      .onConflictDoNothing();
  }

  // Relações 1-pra-muitas sem risco de conflito de unicidade — reatribui
  // direto pro destino.
  await db.update(messages).set({ contactId: targetContactId }).where(eq(messages.contactId, sourceContactId));
  await db.update(deals).set({ contactId: targetContactId }).where(eq(deals.contactId, sourceContactId));
  await db.update(emailsSent).set({ contactId: targetContactId }).where(eq(emailsSent.contactId, sourceContactId));
  await db
    .update(scheduledMessages)
    .set({ contactId: targetContactId })
    .where(eq(scheduledMessages.contactId, sourceContactId));
  await db
    .update(notifications)
    .set({ contactId: targetContactId })
    .where(eq(notifications.contactId, sourceContactId));
  await db.update(npsSurveys).set({ contactId: targetContactId }).where(eq(npsSurveys.contactId, sourceContactId));
}

// Funde um contato criado automaticamente a partir do Instagram Direct (sem
// telefone, nome genérico) dentro de um contato já existente no CRM — usado
// quando o mesmo cliente já tinha cadastro e escreveu pelo Instagram antes de
// alguém perceber que era a mesma pessoa (ver Etapa 25 "salvar/vincular
// contato do Instagram").
export async function mergeInstagramContactInto(
  sourceContactId: string,
  targetContactId: string
): Promise<MergeContactResult> {
  if (sourceContactId === targetContactId) {
    return { ok: false, error: "Não é possível vincular um contato a ele mesmo" };
  }

  const [source] = await db
    .select({
      id: contacts.id,
      instagramUserId: contacts.instagramUserId,
      instagramUsername: contacts.instagramUsername,
    })
    .from(contacts)
    .where(eq(contacts.id, sourceContactId))
    .limit(1);
  if (!source) return { ok: false, error: "Contato de origem não encontrado" };
  if (!source.instagramUserId) {
    return { ok: false, error: "Contato de origem não tem conta do Instagram vinculada" };
  }

  const [target] = await db
    .select({ id: contacts.id, instagramUserId: contacts.instagramUserId })
    .from(contacts)
    .where(eq(contacts.id, targetContactId))
    .limit(1);
  if (!target) return { ok: false, error: "Contato de destino não encontrado" };
  if (target.instagramUserId) {
    return { ok: false, error: "Contato de destino já tem uma conta do Instagram vinculada" };
  }

  await reassignContactRelations(sourceContactId, targetContactId);

  // Libera o valor do índice único (instagram_user_id) antes de gravar no
  // destino.
  await db
    .update(contacts)
    .set({ instagramUserId: null, instagramUsername: null })
    .where(eq(contacts.id, sourceContactId));
  await db
    .update(contacts)
    .set({ instagramUserId: source.instagramUserId, instagramUsername: source.instagramUsername })
    .where(eq(contacts.id, targetContactId));

  // Origem já não tem mais nenhuma relação (tudo reatribuído acima) —
  // seguro apagar.
  await db.delete(contacts).where(eq(contacts.id, sourceContactId));

  return { ok: true };
}

// Funde dois contatos que representam a mesma pessoa — usado quando a
// edição manual de um contato (telefone/email) detecta que o valor já
// pertence a outro contato existente (ver findDuplicateContact em
// src/app/contatos/actions.ts). Telefone/email do destino são responsabi-
// lidade do caller (o valor que o usuário acabou de digitar na edição) —
// esta função só preenche as lacunas de identidade que o destino ainda não
// tem (avatar, Instagram, campos customizados), nunca sobrescreve o que já
// existe lá.
export async function mergeContactsInto(
  sourceContactId: string,
  targetContactId: string
): Promise<MergeContactResult> {
  if (sourceContactId === targetContactId) {
    return { ok: false, error: "Não é possível mesclar um contato com ele mesmo" };
  }

  const [source] = await db
    .select({
      id: contacts.id,
      avatarUrl: contacts.avatarUrl,
      instagramUserId: contacts.instagramUserId,
      instagramUsername: contacts.instagramUsername,
      customFields: contacts.customFields,
      whatsappLid: contacts.whatsappLid,
    })
    .from(contacts)
    .where(eq(contacts.id, sourceContactId))
    .limit(1);
  if (!source) return { ok: false, error: "Contato de origem não encontrado" };

  const [target] = await db
    .select({
      id: contacts.id,
      avatarUrl: contacts.avatarUrl,
      instagramUserId: contacts.instagramUserId,
      instagramUsername: contacts.instagramUsername,
      customFields: contacts.customFields,
      whatsappLid: contacts.whatsappLid,
    })
    .from(contacts)
    .where(eq(contacts.id, targetContactId))
    .limit(1);
  if (!target) return { ok: false, error: "Contato de destino não encontrado" };

  if (source.instagramUserId && target.instagramUserId && source.instagramUserId !== target.instagramUserId) {
    return {
      ok: false,
      error: "Os dois contatos têm contas do Instagram diferentes vinculadas — mescle manualmente antes.",
    };
  }

  await reassignContactRelations(sourceContactId, targetContactId);

  const fillUpdates: Partial<typeof contacts.$inferInsert> = {};
  if (!target.avatarUrl && source.avatarUrl) fillUpdates.avatarUrl = source.avatarUrl;
  if (!target.whatsappLid && source.whatsappLid) {
    // Libera o índice único (whatsapp_lid) antes de gravar no destino, mesmo
    // padrão do instagramUserId logo abaixo — sem isso o update no destino
    // esbarraria na própria linha de origem que ainda detém o valor.
    await db
      .update(contacts)
      .set({ whatsappLid: null })
      .where(eq(contacts.id, sourceContactId));
    fillUpdates.whatsappLid = source.whatsappLid;
  }
  if (!target.instagramUserId && source.instagramUserId) {
    // Libera o índice único antes de gravar no destino.
    await db
      .update(contacts)
      .set({ instagramUserId: null, instagramUsername: null })
      .where(eq(contacts.id, sourceContactId));
    fillUpdates.instagramUserId = source.instagramUserId;
    fillUpdates.instagramUsername = source.instagramUsername;
  }
  const mergedCustomFields = {
    ...((source.customFields as Record<string, unknown>) ?? {}),
    ...((target.customFields as Record<string, unknown>) ?? {}),
  };
  if (Object.keys(mergedCustomFields).length > 0) fillUpdates.customFields = mergedCustomFields;

  if (Object.keys(fillUpdates).length > 0) {
    await db.update(contacts).set(fillUpdates).where(eq(contacts.id, targetContactId));
  }

  await db.delete(contacts).where(eq(contacts.id, sourceContactId));

  return { ok: true };
}

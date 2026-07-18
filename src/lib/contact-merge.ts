import { eq } from "drizzle-orm";
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

// Funde um contato criado automaticamente a partir do Instagram Direct (sem
// telefone, nome genérico) dentro de um contato já existente no CRM — usado
// quando o mesmo cliente já tinha cadastro e escreveu pelo Instagram antes de
// alguém perceber que era a mesma pessoa (ver Etapa 25 "salvar/vincular
// contato do Instagram").
//
// Não roda em transação — o driver neon-http não suporta (ver src/db/index.ts:
// drizzle-orm/neon-http lança "No transactions support..."). A ordem das
// operações abaixo é escolhida pra que uma falha no meio do caminho nunca
// perca dado: tudo que referencia o contato de origem é reatribuído ANTES de
// tocar no índice único instagram_user_id, e a origem só é apagada por
// último, depois que ela não tem mais nenhuma relação pendente. Se falhar no
// meio, o pior caso é a identidade do Instagram ainda presa na origem — o
// próprio botão de "vincular" pode ser clicado de novo pra retomar.
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

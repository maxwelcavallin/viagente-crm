import { and, desc, eq, isNotNull } from "drizzle-orm";
import { db } from "../src/db";
import { contacts, messages, whatsappChannels } from "../src/db/schema";
import { decryptCredential } from "../src/lib/credentials-crypto";
import {
  getZapiGroupMetadata,
  getZapiProfilePicture,
  type ZapiChannelCredentials,
} from "../src/lib/zapi";

// Corrige contatos criados antes da distinção grupo/individual: o nome
// gravado até então era o do remetente da primeira mensagem, não o nome real
// do grupo (bug reportado — ver conversa). Detecta grupo pelo sufixo
// "-group" no phone (formato de ID de grupo da Z-API, sempre confiável,
// nenhuma chamada externa necessária) e busca nome/foto reais via Z-API.
// Também busca foto de perfil pra contatos individuais que ainda não têm
// (avatar_url é campo novo, nenhum contato antigo tinha isso preenchido).

async function lastChannelIdForContact(contactId: string): Promise<string | null> {
  const [row] = await db
    .select({ channelId: messages.channelId })
    .from(messages)
    .where(and(eq(messages.contactId, contactId), isNotNull(messages.channelId)))
    .orderBy(desc(messages.createdAt))
    .limit(1);
  return row?.channelId ?? null;
}

async function main() {
  const allContacts = await db
    .select({
      id: contacts.id,
      name: contacts.name,
      phone: contacts.phone,
      isGroup: contacts.isGroup,
      avatarUrl: contacts.avatarUrl,
    })
    .from(contacts);

  const credsByChannel = new Map<string, ZapiChannelCredentials | null>();
  async function credsForChannel(channelId: string): Promise<ZapiChannelCredentials | null> {
    if (credsByChannel.has(channelId)) return credsByChannel.get(channelId)!;
    const [row] = await db
      .select({
        zapiInstanceId: whatsappChannels.zapiInstanceId,
        zapiToken: whatsappChannels.zapiToken,
        zapiClientToken: whatsappChannels.zapiClientToken,
      })
      .from(whatsappChannels)
      .where(eq(whatsappChannels.id, channelId))
      .limit(1);
    const creds = row
      ? {
          zapiInstanceId: row.zapiInstanceId,
          zapiToken: decryptCredential(row.zapiToken),
          zapiClientToken: decryptCredential(row.zapiClientToken),
        }
      : null;
    credsByChannel.set(channelId, creds);
    return creds;
  }

  let updated = 0;
  let skipped = 0;

  for (const contact of allContacts) {
    const isGroupPhone = contact.phone.endsWith("-group");
    const channelId = await lastChannelIdForContact(contact.id);
    if (!channelId) {
      skipped++;
      continue;
    }
    const creds = await credsForChannel(channelId);
    if (!creds) {
      skipped++;
      continue;
    }

    const patch: Partial<{ name: string; avatarUrl: string; isGroup: boolean }> = {};

    if (isGroupPhone && !contact.isGroup) patch.isGroup = true;

    if (isGroupPhone) {
      const meta = await getZapiGroupMetadata(creds, contact.phone);
      if (meta?.subject && meta.subject !== contact.name) patch.name = meta.subject;
    }

    if (!contact.avatarUrl) {
      const link = await getZapiProfilePicture(creds, contact.phone);
      if (link) patch.avatarUrl = link;
    }

    if (Object.keys(patch).length > 0) {
      await db.update(contacts).set(patch).where(eq(contacts.id, contact.id));
      updated++;
      console.log(`Atualizado "${contact.name}" (${contact.phone}) ->`, patch);
    } else {
      skipped++;
    }
  }

  console.log(`\nConcluído: ${updated} contato(s) atualizado(s), ${skipped} sem mudança/pulado(s).`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Erro ao sincronizar perfis do WhatsApp:", error);
    process.exit(1);
  });

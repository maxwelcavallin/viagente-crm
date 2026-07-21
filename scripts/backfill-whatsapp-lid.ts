import { eq, isNull } from "drizzle-orm";
import { db } from "../src/db";
import { contacts, whatsappChannels } from "../src/db/schema";
import { decryptCredential } from "../src/lib/credentials-crypto";
import { getZapiChats, type ZapiChannelCredentials } from "../src/lib/zapi";

// Pré-popula contacts.whatsapp_lid pra todo contato que já tem telefone real
// mas ainda não tem o lid guardado — inclusive conversas que NÓS iniciamos
// (o telefone já era conhecido de cara, nunca veio de um evento mascarado).
// Sem isso, o sistema só descobre o lid de um contato reativamente, na
// primeira vez que uma mensagem mascarada chega pra ele (ver
// getZapiChatByLid no webhook) — rodar este backfill deixa a maioria dos
// contatos já resolvidos de antemão, então o webhook nem precisa chamar a
// Z-API na hora pra maioria dos casos. Usa a listagem em lote /chats (uma
// chamada por página) em vez de uma chamada por contato — bem mais barato
// pra uma base grande.

async function main() {
  const [channel] = await db
    .select({
      zapiInstanceId: whatsappChannels.zapiInstanceId,
      zapiToken: whatsappChannels.zapiToken,
      zapiClientToken: whatsappChannels.zapiClientToken,
    })
    .from(whatsappChannels)
    .limit(1);
  if (!channel) {
    console.log("Nenhum canal de WhatsApp configurado.");
    return;
  }
  const creds: ZapiChannelCredentials = {
    zapiInstanceId: channel.zapiInstanceId,
    zapiToken: decryptCredential(channel.zapiToken),
    zapiClientToken: decryptCredential(channel.zapiClientToken),
  };

  // Contatos antigos têm telefone salvo em formatos inconsistentes ("+55...",
  // sem "+", sem DDI etc — nunca houve normalização na importação/criação
  // manual) enquanto a Z-API sempre devolve dígitos puros com DDI. Compara só
  // dígitos pra não perder match por causa de "+" ou espaço.
  const onlyDigits = (s: string) => s.replace(/\D/g, "");

  const phoneToLid = new Map<string, string>();
  for (let page = 1; ; page++) {
    const chunk = await getZapiChats(creds, page, 100);
    if (chunk.length === 0) break;
    for (const chat of chunk) {
      if (!chat.isGroup && chat.phone && chat.lid) phoneToLid.set(onlyDigits(chat.phone), chat.lid);
    }
    console.log(`página ${page}: ${chunk.length} chats (${phoneToLid.size} com lid até agora)`);
    if (chunk.length < 100) break;
  }
  console.log(`\nTotal de chats individuais com lid conhecido: ${phoneToLid.size}`);

  const pending = await db
    .select({ id: contacts.id, phone: contacts.phone })
    .from(contacts)
    .where(isNull(contacts.whatsappLid));

  let updated = 0;
  const duplicatePhoneConflicts: { contactId: string; phone: string | null; lid: string }[] = [];
  for (const contact of pending) {
    const lid = contact.phone ? phoneToLid.get(onlyDigits(contact.phone)) : undefined;
    if (!lid) continue;
    try {
      await db.update(contacts).set({ whatsappLid: lid }).where(eq(contacts.id, contact.id));
      updated++;
    } catch (error) {
      // contacts_whatsapp_lid_idx (unique) — outro contato já tem esse lid
      // guardado, ou seja, dois contatos diferentes representam o mesmo
      // telefone real salvo com formatação diferente (bug pré-existente, não
      // relacionado ao lid — não mescla automaticamente, só reporta).
      duplicatePhoneConflicts.push({ contactId: contact.id, phone: contact.phone, lid });
    }
  }

  console.log(`\nConcluído: ${updated} contato(s) tiveram whatsapp_lid preenchido.`);
  if (duplicatePhoneConflicts.length > 0) {
    console.log(
      `\n${duplicatePhoneConflicts.length} contato(s) pulado(s) por conflito de lid já usado por outro contato (provável duplicata de telefone formatado diferente):`
    );
    for (const c of duplicatePhoneConflicts) {
      console.log(`  contact ${c.contactId} (phone=${c.phone}) — lid ${c.lid} já pertence a outro contato`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Erro ao fazer backfill de whatsapp_lid:", error);
    process.exit(1);
  });

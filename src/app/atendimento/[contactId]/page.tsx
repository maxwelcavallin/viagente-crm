import { notFound, redirect } from "next/navigation";
import { and, asc, eq, inArray, isNull, ne } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import {
  contacts,
  customFieldDefinitions,
  deals,
  instagramChannels,
  whatsappChannels,
} from "@/db/schema";
import { getAllowedChannelIds } from "@/lib/channel-access";
import { getThread, markContactRead } from "@/lib/conversations";
import { formatCustomFieldValue, type FieldDef } from "@/lib/custom-fields";
import { formatCurrencyBRL } from "@/lib/deal-format";
import { findOpenDealIdForContact } from "@/lib/messaging";
import { getPendingScheduledMessages } from "@/lib/scheduled-messages";
import { canViewOwnedRecord } from "@/lib/visibility";
import type { ContactDealParam } from "@/components/insert-param-button";
import type { LinkContactTarget } from "./link-contact-dialog";
import { ConversationThread } from "./conversation-thread";

export const dynamic = "force-dynamic";

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ contactId: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { contactId } = await params;

  const [contact] = await db
    .select({
      id: contacts.id,
      name: contacts.name,
      phone: contacts.phone,
      email: contacts.email,
      isGroup: contacts.isGroup,
      avatarUrl: contacts.avatarUrl,
      instagramUserId: contacts.instagramUserId,
      instagramUsername: contacts.instagramUsername,
      customFields: contacts.customFields,
      ownerId: contacts.ownerId,
    })
    .from(contacts)
    .where(eq(contacts.id, contactId))
    .limit(1);
  if (!contact) notFound();
  if (!canViewOwnedRecord(contact.ownerId, session.user)) notFound();

  const allowedChannelIds = await getAllowedChannelIds(
    session.user.id,
    session.user.role
  );

  // Marca lida pra equipe inteira ao abrir a conversa (inbox compartilhado).
  // Só reflete no contador da lista no próximo router.refresh() do polling
  // em AtendimentoShell, não instantaneamente — mesmo comportamento de
  // atraso já aceito hoje pra mensagens novas chegando.
  await markContactRead(contactId);

  const [thread, allowedWhatsappChannels, allowedInstagramChannels, pendingScheduled, openDealId, fieldDefRows] =
    await Promise.all([
      getThread(contactId, allowedChannelIds),
      allowedChannelIds.length > 0
        ? db
            .select({ id: whatsappChannels.id, label: whatsappChannels.label, isDefault: whatsappChannels.isDefault })
            .from(whatsappChannels)
            .where(inArray(whatsappChannels.id, allowedChannelIds))
        : Promise.resolve([]),
      allowedChannelIds.length > 0
        ? db
            .select({ id: instagramChannels.id, label: instagramChannels.label, isDefault: instagramChannels.isDefault })
            .from(instagramChannels)
            .where(inArray(instagramChannels.id, allowedChannelIds))
        : Promise.resolve([]),
      getPendingScheduledMessages(contactId),
      findOpenDealIdForContact(contactId),
      db.select().from(customFieldDefinitions).orderBy(asc(customFieldDefinitions.order)),
    ]);

  const allowedChannels = [
    ...allowedWhatsappChannels.map((c) => ({ ...c, channelType: "whatsapp" as const })),
    ...allowedInstagramChannels.map((c) => ({ ...c, channelType: "instagram" as const })),
  ];

  // Alvos pra "vincular a contato existente" (ver Etapa 25) — só monta a
  // lista quando faz sentido (contato veio do Instagram), já que exige duas
  // queries extras. Só contatos sem instagramUserId entram como alvo válido
  // (mergeInstagramContactInto recusa destino que já tenha um vinculado).
  let linkTargets: LinkContactTarget[] = [];
  if (contact.instagramUserId) {
    const [otherContacts, openDeals] = await Promise.all([
      db
        .select({ id: contacts.id, name: contacts.name, phone: contacts.phone })
        .from(contacts)
        .where(and(ne(contacts.id, contactId), isNull(contacts.instagramUserId))),
      db
        .select({
          id: deals.id,
          title: deals.title,
          contactId: deals.contactId,
          contactName: contacts.name,
        })
        .from(deals)
        .innerJoin(contacts, eq(contacts.id, deals.contactId))
        .where(and(eq(deals.status, "aberto"), isNull(contacts.instagramUserId))),
    ]);
    linkTargets = [
      ...otherContacts.map((c) => ({
        contactId: c.id,
        label: c.name,
        sublabel: c.phone ?? undefined,
      })),
      ...openDeals.map((d) => ({
        contactId: d.contactId,
        label: d.title,
        sublabel: d.contactName,
      })),
    ];
  }

  const [openDeal] = openDealId
    ? await db
        .select({ value: deals.value, customFields: deals.customFields })
        .from(deals)
        .where(eq(deals.id, openDealId))
        .limit(1)
    : [];

  // Valores JÁ resolvidos (não placeholders {{}}) — usados pelo botão de
  // inserir parâmetro no composer, que escreve o texto final na hora, sem
  // etapa de substituição depois (diferente dos templates).
  const contactCustomFields = (contact.customFields as Record<string, unknown>) ?? {};
  const dealCustomFields = (openDeal?.customFields as Record<string, unknown>) ?? {};
  const contactParams: ContactDealParam[] = [
    { key: "nome_contato", label: "Nome do contato", value: contact.name },
  ];
  if (contact.email) {
    contactParams.push({ key: "email_contato", label: "Email do contato", value: contact.email });
  }
  if (openDeal?.value) {
    const formatted = formatCurrencyBRL(openDeal.value);
    if (formatted) contactParams.push({ key: "valor", label: "Valor do negócio", value: formatted });
  }
  for (const def of fieldDefRows) {
    const source = def.entity === "deal" ? dealCustomFields : contactCustomFields;
    const raw = source[def.key];
    if (raw == null || raw === "") continue;
    const fieldDef: FieldDef = {
      id: def.id,
      key: def.key,
      label: def.label,
      type: def.type,
      options: def.options as { value: string; label: string }[] | null,
    };
    contactParams.push({
      key: def.key,
      label: `${def.label} (${def.entity === "contact" ? "contato" : "negócio"})`,
      value: formatCustomFieldValue(fieldDef, raw),
    });
  }

  const lastChannelId = [...thread].reverse().find((m) => m.channelId)?.channelId;
  const defaultChannel = allowedChannels.find((c) => c.isDefault);
  const preselectedChannelId =
    (lastChannelId && allowedChannels.some((c) => c.id === lastChannelId) ? lastChannelId : null) ??
    defaultChannel?.id ??
    allowedChannels[0]?.id ??
    null;

  return (
    <ConversationThread
      contactId={contact.id}
      contactName={contact.name}
      contactPhone={contact.phone}
      instagramUsername={contact.instagramUsername}
      isInstagramContact={Boolean(contact.instagramUserId)}
      linkTargets={linkTargets}
      isGroup={contact.isGroup}
      avatarUrl={contact.avatarUrl}
      initialMessages={thread}
      channels={allowedChannels.map((c) => ({ id: c.id, label: c.label, channelType: c.channelType }))}
      preselectedChannelId={preselectedChannelId}
      params={contactParams}
      scheduledMessages={pendingScheduled.map((m) => ({
        id: m.id,
        content: m.content,
        scheduledAt: m.scheduledAt.toISOString(),
      }))}
    />
  );
}

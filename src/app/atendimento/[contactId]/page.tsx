import { notFound, redirect } from "next/navigation";
import { eq, inArray } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { contacts, whatsappChannels } from "@/db/schema";
import { getAllowedChannelIds } from "@/lib/channel-access";
import { getThread } from "@/lib/conversations";
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
    .select({ id: contacts.id, name: contacts.name, phone: contacts.phone })
    .from(contacts)
    .where(eq(contacts.id, contactId))
    .limit(1);
  if (!contact) notFound();

  const allowedChannelIds = await getAllowedChannelIds(
    session.user.id,
    session.user.role
  );

  const [thread, allowedChannels] = await Promise.all([
    getThread(contactId, allowedChannelIds),
    allowedChannelIds.length > 0
      ? db
          .select({ id: whatsappChannels.id, label: whatsappChannels.label, isDefault: whatsappChannels.isDefault })
          .from(whatsappChannels)
          .where(inArray(whatsappChannels.id, allowedChannelIds))
      : Promise.resolve([]),
  ]);

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
      initialMessages={thread}
      channels={allowedChannels.map((c) => ({ id: c.id, label: c.label }))}
      preselectedChannelId={preselectedChannelId}
    />
  );
}

import { redirect } from "next/navigation";
import { asc } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { tags, users } from "@/db/schema";
import { AppShell } from "@/components/app-shell";
import { getAllowedChannelIds } from "@/lib/channel-access";
import { listConversations } from "@/lib/conversations";
import { AtendimentoShell } from "./atendimento-shell";

export const dynamic = "force-dynamic";

export default async function AtendimentoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const allowedChannelIds = await getAllowedChannelIds(
    session.user.id,
    session.user.role
  );
  const [conversations, allUsers, allTags] = await Promise.all([
    listConversations(allowedChannelIds, session.user),
    db.select({ id: users.id, name: users.name }).from(users).orderBy(asc(users.name)),
    db.select({ id: tags.id, name: tags.name }).from(tags).orderBy(asc(tags.name)),
  ]);

  return (
    <AppShell>
      <AtendimentoShell
        conversations={conversations}
        currentUserId={session.user.id}
        users={allUsers}
        tags={allTags}
      >
        {children}
      </AtendimentoShell>
    </AppShell>
  );
}

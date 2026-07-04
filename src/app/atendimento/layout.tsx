import { redirect } from "next/navigation";
import { auth } from "@/auth";
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
  const conversations = await listConversations(allowedChannelIds);

  return (
    <AppShell>
      <AtendimentoShell conversations={conversations}>{children}</AtendimentoShell>
    </AppShell>
  );
}

import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { contacts, deals } from "@/db/schema";
import { getAllowedChannelIds } from "@/lib/channel-access";
import { getThread } from "@/lib/conversations";

export const dynamic = "force-dynamic";

function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

const MEDIA_LABEL: Record<string, string> = {
  imagem: "Imagem",
  audio: "Áudio",
  documento: "Documento",
  video: "Vídeo",
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ contactId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { contactId } = await params;
  // ?channel= exporta só aquela conversa (ver Etapa "não misturar canais");
  // sem o param, mantém o comportamento antigo de mesclar tudo (link antigo
  // ou uso direto da rota).
  const channelParam = new URL(request.url).searchParams.get("channel");
  const channelId = channelParam === null ? undefined : channelParam === "none" ? null : channelParam;

  const [contact] = await db
    .select({ id: contacts.id, name: contacts.name, phone: contacts.phone })
    .from(contacts)
    .where(eq(contacts.id, contactId))
    .limit(1);
  if (!contact) {
    return Response.json({ error: "Contato não encontrado" }, { status: 404 });
  }

  const allowedChannelIds = await getAllowedChannelIds(
    session.user.id,
    session.user.role
  );

  const thread = await getThread(contactId, channelId, allowedChannelIds);

  const channelLabels = Array.from(
    new Set(thread.map((m) => m.channelLabel).filter((label): label is string => Boolean(label)))
  );

  const linkedDealId = thread.map((m) => m.dealId).find((id) => id);
  let dealTitle: string | null = null;
  if (linkedDealId) {
    const [deal] = await db
      .select({ title: deals.title })
      .from(deals)
      .where(eq(deals.id, linkedDealId))
      .limit(1);
    dealTitle = deal?.title ?? null;
  }

  const origin = new URL(request.url).origin;

  const lines: string[] = [];
  lines.push(`# Conversa com ${contact.name}`);
  lines.push("");
  lines.push(`**Telefone:** ${contact.phone}`);
  lines.push(`**Canal(is):** ${channelLabels.length > 0 ? channelLabels.join(", ") : "—"}`);
  lines.push(`**Negócio vinculado:** ${dealTitle ?? "Nenhum"}`);
  lines.push(`**Exportado em:** ${formatDateTime(new Date())}`);
  lines.push("");
  lines.push("---");
  lines.push("");

  for (const message of thread) {
    const who = message.direction === "entrada" ? "Cliente" : "Equipe Viagente";
    const timestamp = formatDateTime(message.createdAt);
    let body: string;
    if (message.type === "texto") {
      body = message.content ?? "";
    } else {
      const label = MEDIA_LABEL[message.type] ?? message.type;
      const url = message.mediaUrl ? `${origin}${message.mediaUrl}` : "#";
      body = `📎 [${label}](${url})${message.content ? ` — ${message.content}` : ""}`;
    }
    lines.push(`**[${timestamp}] ${who}:** ${body}`);
    lines.push("");
  }

  const markdown = lines.join("\n");
  const fileName = `conversa-${contact.name.replace(/[^a-zA-Z0-9-_]+/g, "-")}.md`;

  return new Response(markdown, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}

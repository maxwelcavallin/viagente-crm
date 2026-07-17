import { eq } from "drizzle-orm";
import { db } from "@/db";
import { emailSettings, emailsSent, tasks } from "@/db/schema";
import { decryptCredential } from "@/lib/credentials-crypto";
import { sendEmail } from "@/lib/email-provider";
import { getMediaSignedUrl } from "@/lib/storage";

export type EmailAttachmentInput = { filename: string; key: string };

export type SendDealEmailResult =
  | { ok: true; emailSentId: string }
  | { ok: false; error: string };

async function fetchAttachmentBytes(
  key: string
): Promise<{ content: Buffer; contentType: string }> {
  const signedUrl = await getMediaSignedUrl(key, { expiresInSeconds: 120 });
  const res = await fetch(signedUrl);
  if (!res.ok) throw new Error(`Falha ao ler anexo ${key} (status ${res.status})`);
  const contentType = res.headers.get("content-type") ?? "application/octet-stream";
  const content = Buffer.from(await res.arrayBuffer());
  return { content, contentType };
}

// Núcleo do envio de email (Etapa 26) — compartilhado entre a execução de
// tarefa tipo 'email' e o envio avulso (sem tarefa). Grava em emails_sent e,
// se taskId for informado, marca a tarefa como concluída — mesmo padrão de
// sendTextMessage/completeTaskAction pro fluxo de mensagem.
export async function sendDealEmail(params: {
  dealId: string;
  contactId: string;
  taskId?: string | null;
  to: string;
  subject: string;
  body: string;
  attachments: EmailAttachmentInput[];
  sentByUserId: string;
}): Promise<SendDealEmailResult> {
  const [settings] = await db.select().from(emailSettings).limit(1);
  if (!settings) {
    return { ok: false, error: "Nenhum remetente de email configurado em /configuracoes." };
  }

  let attachmentBytes: { filename: string; content: Buffer; contentType: string }[];
  try {
    attachmentBytes = await Promise.all(
      params.attachments.map(async (a) => {
        const { content, contentType } = await fetchAttachmentBytes(a.key);
        return { filename: a.filename, content, contentType };
      })
    );
  } catch (error) {
    console.error("[emails] falha ao ler anexos", error);
    return { ok: false, error: "Falha ao ler um dos anexos." };
  }

  try {
    await sendEmail(settings.provider, decryptCredential(settings.apiKey), {
      fromAddress: settings.fromAddress,
      fromName: settings.fromName,
      to: params.to,
      subject: params.subject,
      html: params.body,
      attachments: attachmentBytes,
    });
  } catch (error) {
    console.error("[emails] falha ao enviar", error);
    const message = error instanceof Error ? error.message : "Falha ao enviar email";
    await db.insert(emailsSent).values({
      dealId: params.dealId,
      contactId: params.contactId,
      taskId: params.taskId ?? null,
      toEmail: params.to,
      subject: params.subject,
      body: params.body,
      attachments: params.attachments.map((a) => ({
        filename: a.filename,
        url: `/api/emails/attachments?key=${encodeURIComponent(a.key)}`,
      })),
      sentByUserId: params.sentByUserId,
      status: "falhou",
      errorMessage: message,
    });
    return { ok: false, error: message };
  }

  const [created] = await db
    .insert(emailsSent)
    .values({
      dealId: params.dealId,
      contactId: params.contactId,
      taskId: params.taskId ?? null,
      toEmail: params.to,
      subject: params.subject,
      body: params.body,
      attachments: params.attachments.map((a) => ({
        filename: a.filename,
        url: `/api/emails/attachments?key=${encodeURIComponent(a.key)}`,
      })),
      sentByUserId: params.sentByUserId,
      status: "enviado",
    })
    .returning({ id: emailsSent.id });

  if (params.taskId) {
    await db
      .update(tasks)
      .set({ status: "concluida", completedAt: new Date(), completedBy: params.sentByUserId })
      .where(eq(tasks.id, params.taskId));
  }

  return { ok: true, emailSentId: created.id };
}

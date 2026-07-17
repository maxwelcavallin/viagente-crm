// Cliente pros 3 provedores de envio transacional suportados (Etapa 26) —
// endpoints e formatos conforme documentação oficial de cada um. Só envio
// (nunca recebimento), então cada função é um único POST.

export type EmailProvider = "resend" | "postmark" | "sendgrid";

export type EmailAttachment = {
  filename: string;
  content: Buffer;
  contentType: string;
};

export type SendEmailParams = {
  fromAddress: string;
  fromName: string;
  to: string;
  subject: string;
  html: string;
  attachments: EmailAttachment[];
};

async function sendViaResend(apiKey: string, params: SendEmailParams): Promise<{ id: string }> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `${params.fromName} <${params.fromAddress}>`,
      to: [params.to],
      subject: params.subject,
      html: params.html,
      attachments: params.attachments.map((a) => ({
        filename: a.filename,
        content: a.content.toString("base64"),
      })),
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Resend respondeu ${res.status}: ${text}`);
  }
  const data = (await res.json()) as { id?: string };
  if (!data.id) throw new Error("Resend não retornou id na resposta de envio");
  return { id: data.id };
}

async function sendViaPostmark(
  apiKey: string,
  params: SendEmailParams
): Promise<{ id: string }> {
  const res = await fetch("https://api.postmarkapp.com/email", {
    method: "POST",
    headers: {
      "X-Postmark-Server-Token": apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      From: `${params.fromName} <${params.fromAddress}>`,
      To: params.to,
      Subject: params.subject,
      HtmlBody: params.html,
      Attachments: params.attachments.map((a) => ({
        Name: a.filename,
        Content: a.content.toString("base64"),
        ContentType: a.contentType,
      })),
    }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    MessageID?: string;
    ErrorCode?: number;
    Message?: string;
  };
  if (!res.ok || data.ErrorCode) {
    throw new Error(`Postmark respondeu ${res.status}: ${data.Message ?? "erro desconhecido"}`);
  }
  if (!data.MessageID) throw new Error("Postmark não retornou MessageID na resposta de envio");
  return { id: data.MessageID };
}

async function sendViaSendgrid(
  apiKey: string,
  params: SendEmailParams
): Promise<{ id: string }> {
  const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: params.to }] }],
      from: { email: params.fromAddress, name: params.fromName },
      subject: params.subject,
      content: [{ type: "text/html", value: params.html }],
      attachments: params.attachments.map((a) => ({
        content: a.content.toString("base64"),
        filename: a.filename,
        type: a.contentType,
      })),
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`SendGrid respondeu ${res.status}: ${text}`);
  }
  // SendGrid responde 202 sem corpo — o id de rastreio vem no header.
  const id = res.headers.get("x-message-id") ?? res.headers.get("X-Message-Id") ?? randomFallbackId();
  return { id };
}

function randomFallbackId(): string {
  return `sendgrid-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export async function sendEmail(
  provider: EmailProvider,
  apiKey: string,
  params: SendEmailParams
): Promise<{ id: string }> {
  if (provider === "resend") return sendViaResend(apiKey, params);
  if (provider === "postmark") return sendViaPostmark(apiKey, params);
  return sendViaSendgrid(apiKey, params);
}

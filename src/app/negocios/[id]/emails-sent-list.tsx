import { Mail, Paperclip } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

export type EmailSentItem = {
  id: string;
  toEmail: string;
  subject: string;
  status: "enviado" | "falhou";
  errorMessage: string | null;
  sentAt: string;
  attachments: { filename: string; url: string }[];
};

function formatSentAt(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function EmailsSentList({ emails }: { emails: EmailSentItem[] }) {
  if (emails.length === 0) {
    return (
      <EmptyState
        icon={Mail}
        title="Nenhum email enviado ainda"
        description="Emails enviados a partir deste negócio aparecem aqui."
      />
    );
  }

  return (
    <ul className="space-y-2">
      {emails.map((email) => (
        <li key={email.id} className="rounded-lg border border-border p-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-medium">{email.subject}</span>
            <Badge variant={email.status === "enviado" ? "success" : "destructive"}>
              {email.status}
            </Badge>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Para {email.toEmail} · {formatSentAt(email.sentAt)}
          </p>
          {email.errorMessage && (
            <p className="mt-1 text-xs text-destructive">{email.errorMessage}</p>
          )}
          {email.attachments.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-2">
              {email.attachments.map((a) => (
                <a
                  key={a.url}
                  href={a.url}
                  className="flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <Paperclip size={11} strokeWidth={1.75} />
                  {a.filename}
                </a>
              ))}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

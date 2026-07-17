"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Paperclip, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { uploadEmailAttachment } from "@/lib/upload-email-attachment-client";

export type EmailTemplateOption = { id: string; name: string; subject: string; content: string };

// Mesmo padrão avulso de ScheduleMeetingDialog: botão solto no detalhe do
// negócio, sem depender de uma tarefa pré-existente (ver Etapa 26).
export function EmailComposeDialog({
  dealId,
  contactId,
  contactEmail,
  templates,
  trigger,
  triggerLabel,
  onSent,
}: {
  dealId: string;
  contactId: string;
  contactEmail: string | null;
  templates: EmailTemplateOption[];
  trigger: React.ReactElement;
  triggerLabel: React.ReactNode;
  onSent?: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [to, setTo] = useState(contactEmail ?? "");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [attachments, setAttachments] = useState<{ filename: string; key: string }[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleTemplateChange(value: string | null) {
    setTemplateId(value);
    const template = templates.find((t) => t.id === value);
    if (template) {
      setSubject(template.subject);
      setBody(template.content);
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    setIsUploading(true);
    setError(null);
    try {
      for (const file of files) {
        const uploaded = await uploadEmailAttachment(file);
        setAttachments((prev) => [...prev, uploaded]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao anexar arquivo.");
    } finally {
      setIsUploading(false);
    }
  }

  function removeAttachment(key: string) {
    setAttachments((prev) => prev.filter((a) => a.key !== key));
  }

  async function handleSend() {
    if (!to.trim() || !subject.trim() || !body.trim()) return;
    setIsSending(true);
    setError(null);
    try {
      const res = await fetch("/api/emails/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dealId,
          contactId,
          to: to.trim(),
          subject: subject.trim(),
          body,
          attachments,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Falha ao enviar email.");
      }
      setOpen(false);
      setTemplateId(null);
      setSubject("");
      setBody("");
      setAttachments([]);
      router.refresh();
      onSent?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao enviar email.");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger}>{triggerLabel}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Enviar email</DialogTitle>
        </DialogHeader>
        <div className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
          {templates.length > 0 && (
            <div className="space-y-2">
              <Label>Template (opcional)</Label>
              <Select
                items={Object.fromEntries(templates.map((t) => [t.id, t.name]))}
                value={templateId}
                onValueChange={handleTemplateChange}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Nenhum" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-2">
            <Label>Destinatário</Label>
            <Input value={to} onChange={(e) => setTo(e.target.value)} type="email" />
          </div>
          <div className="space-y-2">
            <Label>Assunto</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Corpo</Label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={8}
              className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20"
            />
          </div>
          {attachments.length > 0 && (
            <ul className="space-y-1">
              {attachments.map((a) => (
                <li
                  key={a.key}
                  className="flex items-center gap-2 rounded-md bg-muted px-2 py-1 text-xs"
                >
                  <span className="min-w-0 flex-1 truncate">{a.filename}</span>
                  <button
                    type="button"
                    onClick={() => removeAttachment(a.key)}
                    aria-label="Remover anexo"
                    className="shrink-0 text-muted-foreground hover:text-foreground"
                  >
                    <X size={12} strokeWidth={1.75} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isUploading}
            onClick={() => fileInputRef.current?.click()}
          >
            <Paperclip size={13} strokeWidth={1.75} />
            {isUploading ? "Anexando..." : "Anexar arquivo"}
          </Button>
          <input ref={fileInputRef} type="file" multiple hidden onChange={handleFileChange} />
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>Cancelar</DialogClose>
          <Button
            type="button"
            disabled={isSending || !to.trim() || !subject.trim() || !body.trim()}
            onClick={handleSend}
          >
            {isSending ? "Enviando..." : "Enviar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

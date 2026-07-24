"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
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
import type { QuickFillMessageTemplate } from "@/lib/templates";

// Formato aceito por <input type="datetime-local">: "YYYY-MM-DDTHH:mm" em
// horário local (não UTC) — por isso não dá pra usar toISOString() direto.
function nowLocalDatetimeValue(): string {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16);
}

export function ScheduleMessageDialog({
  contactId,
  dealId,
  channels,
  defaultChannelId,
  defaultMessage,
  templates = [],
  trigger,
  triggerLabel,
  onScheduled,
}: {
  contactId: string;
  dealId?: string;
  channels: { id: string; label: string }[];
  defaultChannelId: string | null;
  defaultMessage?: string;
  templates?: QuickFillMessageTemplate[];
  trigger: React.ReactElement;
  triggerLabel: React.ReactNode;
  onScheduled?: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState(defaultMessage ?? "");
  const [channelId, setChannelId] = useState(defaultChannelId ?? channels[0]?.id ?? "");
  const [scheduledAt, setScheduledAt] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedTemplate = templates.find((t) => t.id === templateId);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setMessage(defaultMessage ?? "");
      setChannelId(defaultChannelId ?? channels[0]?.id ?? "");
      setScheduledAt("");
      setTemplateId("");
      setError(null);
    }
  }

  // Preenche o texto com o template escolhido — o campo continua editável
  // depois, então dá pra ajustar manualmente em cima do template ou ignorar
  // o seletor e escrever do zero.
  function handleTemplateChange(nextId: string) {
    setTemplateId(nextId);
    const template = templates.find((t) => t.id === nextId);
    if (template) setMessage(template.content);
  }

  async function handleSubmit() {
    if (!message.trim() || !channelId || !scheduledAt) return;
    setIsPending(true);
    setError(null);
    try {
      const res = await fetch("/api/messages/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channelId,
          contactId,
          dealId,
          message: message.trim(),
          scheduledAt: new Date(scheduledAt).toISOString(),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Falha ao agendar mensagem.");
      }
      setOpen(false);
      onScheduled?.();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao agendar mensagem.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={trigger}>{triggerLabel}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Agendar envio de mensagem</DialogTitle>
          <DialogDescription>
            A mensagem é enviada automaticamente no horário escolhido, sem
            precisar reabrir a conversa.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {channels.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Você não tem acesso a nenhum canal pra agendar.
            </p>
          ) : (
            <>
              <div className="space-y-2">
                <Label>Canal</Label>
                <Select
                  items={Object.fromEntries(channels.map((c) => [c.id, c.label]))}
                  value={channelId}
                  onValueChange={(v) => setChannelId(v ?? "")}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Canal" />
                  </SelectTrigger>
                  <SelectContent>
                    {channels.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {templates.length > 0 && (
                <div className="space-y-2">
                  <Label>Preencher com template (opcional)</Label>
                  <Select
                    items={Object.fromEntries([
                      ["", "Escrever manualmente"],
                      ...templates.map((t) => [t.id, t.name]),
                    ])}
                    value={templateId}
                    onValueChange={(v) => handleTemplateChange(v ?? "")}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Escrever manualmente" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Escrever manualmente</SelectItem>
                      {templates.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedTemplate?.hasMedia && (
                    <p className="text-xs text-muted-foreground">
                      Este template tem anexo — mensagens agendadas só enviam texto, o anexo não entra.
                    </p>
                  )}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="schedule-message">Mensagem</Label>
                <textarea
                  id="schedule-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="schedule-at">Data e hora do envio</Label>
                <Input
                  id="schedule-at"
                  type="datetime-local"
                  value={scheduledAt}
                  min={nowLocalDatetimeValue()}
                  onChange={(e) => setScheduledAt(e.target.value)}
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
            </>
          )}
        </div>
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>
            Cancelar
          </DialogClose>
          <Button
            type="button"
            disabled={isPending || !message.trim() || !channelId || !scheduledAt}
            onClick={handleSubmit}
          >
            {isPending ? "Agendando..." : "Agendar envio"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

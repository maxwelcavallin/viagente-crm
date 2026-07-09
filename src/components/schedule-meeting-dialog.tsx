"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
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
import { buildGoogleCalendarFallbackLink } from "@/lib/google-calendar-link";

const DURATION_OPTIONS: Record<string, string> = {
  "30": "30 minutos",
  "60": "1 hora",
  "90": "1h30",
  "120": "2 horas",
};

// Formato aceito por <input type="datetime-local">: "YYYY-MM-DDTHH:mm" em
// horário local — mesma limitação do ScheduleMessageDialog (Etapa 8).
function nowLocalDatetimeValue(): string {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16);
}

export function ScheduleMeetingDialog({
  dealId,
  contactEmail,
  isConnected,
  taskId,
  defaultTitle,
  trigger,
  triggerLabel,
  onScheduled,
}: {
  dealId?: string;
  contactEmail?: string | null;
  isConnected: boolean;
  taskId?: string;
  defaultTitle?: string;
  trigger: React.ReactElement;
  triggerLabel: React.ReactNode;
  onScheduled?: () => void | Promise<void>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [connectionAvailable, setConnectionAvailable] = useState(isConnected);
  const [title, setTitle] = useState(defaultTitle ?? "");
  const [startAt, setStartAt] = useState("");
  const [duration, setDuration] = useState("30");
  const [description, setDescription] = useState("");
  const [isPending, setIsPending] = useState(false);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setConnectionAvailable(isConnected);
      setTitle(defaultTitle ?? "");
      setStartAt("");
      setDuration("30");
      setDescription("");
    }
  }

  function computeRange(): { start: Date; end: Date } | null {
    if (!startAt) return null;
    const start = new Date(startAt);
    if (Number.isNaN(start.getTime())) return null;
    const end = new Date(start.getTime() + Number(duration) * 60_000);
    return { start, end };
  }

  async function handleSubmit() {
    const range = computeRange();
    if (!title.trim() || !range) return;

    setIsPending(true);
    try {
      const res = await fetch("/api/calendar/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          startAt: range.start.toISOString(),
          endAt: range.end.toISOString(),
          description: description.trim(),
          contactEmail: contactEmail || null,
          dealId,
          taskId,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (data.error === "not_connected") {
          setConnectionAvailable(false);
          return;
        }
        throw new Error(data.message ?? "Falha ao criar o evento no Google Agenda.");
      }

      toast.success("Reunião agendada no Google Agenda.");
      setOpen(false);
      await onScheduled?.();
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao criar o evento no Google Agenda.");
    } finally {
      setIsPending(false);
    }
  }

  const range = computeRange();
  const fallbackLink =
    range && title.trim()
      ? buildGoogleCalendarFallbackLink({
          title: title.trim(),
          startAt: range.start,
          endAt: range.end,
          description: description.trim() || undefined,
        })
      : null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={trigger}>{triggerLabel}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Agendar reunião</DialogTitle>
          {connectionAvailable && (
            <DialogDescription>
              Cria um evento de verdade no Google Agenda — convida o contato automaticamente
              se ele tiver email.
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="space-y-4">
          {!connectionAvailable && (
            <div className="space-y-2 rounded-lg border border-status-warning/40 bg-status-warning/10 p-3 text-sm">
              <p>
                Conecte seu Google Agenda em <strong>Meu Perfil</strong> pra agendar direto
                por aqui, com confirmação real de que o evento foi criado.
              </p>
              <Link href="/perfil" className={buttonVariants({ variant: "outline", size: "sm" })}>
                Ir pra Meu Perfil
              </Link>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="meeting-title">Título</Label>
            <Input
              id="meeting-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Reunião de diagnóstico"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="meeting-start">Data e hora</Label>
              <Input
                id="meeting-start"
                type="datetime-local"
                value={startAt}
                min={nowLocalDatetimeValue()}
                onChange={(e) => setStartAt(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Duração</Label>
              <Select items={DURATION_OPTIONS} value={duration} onValueChange={(v) => setDuration(v ?? "30")}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(DURATION_OPTIONS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="meeting-description">Observação</Label>
            <textarea
              id="meeting-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20"
            />
          </div>

          {!connectionAvailable && fallbackLink && (
            <a
              href={fallbackLink}
              target="_blank"
              rel="noreferrer"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Adicionar ao Google Agenda (link simples)
            </a>
          )}
        </div>

        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>
            Cancelar
          </DialogClose>
          {connectionAvailable && (
            <Button
              type="button"
              disabled={isPending || !title.trim() || !range}
              onClick={handleSubmit}
            >
              {isPending ? "Agendando..." : "Agendar"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Controlado externamente (sem DialogTrigger próprio) de propósito: os
// pontos que abrem esse diálogo (item de DropdownMenu no card do kanban,
// ação em massa) têm problemas conhecidos de foco/portal quando um Dialog
// é aninhado dentro do próprio trigger — abrir via estado do componente pai
// evita isso por completo.
export function MarkLostDialog({
  open,
  onOpenChange,
  reasons,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reasons: { id: string; label: string }[];
  onConfirm: (lossReasonId: string) => void | Promise<void>;
}) {
  const [reasonId, setReasonId] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    // Reseta a seleção sempre que o diálogo (controlado externamente) abre
    // de novo — mesmo padrão já usado em theme-toggle.tsx pra sincronizar
    // com um evento externo (abrir), não com todo re-render.
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setReasonId(reasons[0]?.id ?? null);
    }
  }, [open, reasons]);

  async function handleConfirm() {
    if (!reasonId) return;
    setIsPending(true);
    await onConfirm(reasonId);
    setIsPending(false);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Marcar como Perdido</DialogTitle>
          <DialogDescription>
            Selecione o motivo da perda — usado nos indicadores da página Início.
          </DialogDescription>
        </DialogHeader>
        {reasons.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum motivo de perda cadastrado pra essa pipeline. Cadastre em
            Configurações → Pipelines e Etapas → editar a pipeline → &quot;Motivos de
            perda&quot;.
          </p>
        ) : (
          <div className="space-y-2">
            <Label>Motivo</Label>
            <Select
              items={Object.fromEntries(reasons.map((r) => [r.id, r.label]))}
              value={reasonId}
              onValueChange={(v) => setReasonId(v ?? null)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione um motivo" />
              </SelectTrigger>
              <SelectContent>
                {reasons.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>
            Cancelar
          </DialogClose>
          <Button
            type="button"
            variant="destructive"
            disabled={isPending || !reasonId}
            onClick={handleConfirm}
          >
            {isPending ? "Salvando..." : "Marcar como Perdido"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Link2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { cn } from "@/lib/utils";

export type LinkContactTarget = {
  contactId: string;
  label: string;
  sublabel?: string;
};

// Diálogo pra fundir um contato criado automaticamente a partir do Instagram
// Direct (sem telefone, nome genérico vindo do perfil) dentro de um contato
// já existente no CRM — mostra tanto contatos quanto negócios abertos como
// alvo (escolher um negócio funde no contato dono dele).
export function LinkContactDialog({
  sourceContactId,
  targets,
}: {
  sourceContactId: string;
  targets: LinkContactTarget[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setSearch("");
      setSelectedId(null);
      setError(null);
    }
  }

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = term
      ? targets.filter(
          (t) =>
            t.label.toLowerCase().includes(term) ||
            (t.sublabel?.toLowerCase().includes(term) ?? false)
        )
      : targets;
    return list.slice(0, 30);
  }, [targets, search]);

  async function handleSubmit() {
    if (!selectedId) return;
    setIsPending(true);
    setError(null);
    try {
      const res = await fetch("/api/contacts/merge-instagram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceContactId,
          targetContactId: selectedId,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Falha ao vincular contato.");
      }
      setOpen(false);
      router.push(`/atendimento/${selectedId}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao vincular contato.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button type="button" variant="outline" size="sm" />}>
        <Link2 size={14} strokeWidth={1.75} />
        Vincular a contato existente
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Vincular contato do Instagram</DialogTitle>
          <DialogDescription>
            Move todo o histórico deste contato (mensagens, negócios, tags) pro
            contato ou negócio escolhido abaixo, e remove este registro
            duplicado do Instagram.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="relative">
            <Search
              size={14}
              strokeWidth={1.75}
              className="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar contato ou negócio..."
              className="h-9 pl-7 text-sm"
            />
          </div>
          <div className="max-h-64 space-y-0.5 overflow-y-auto">
            {filtered.length === 0 && (
              <p className="px-2 py-3 text-center text-xs text-muted-foreground">
                Nada encontrado.
              </p>
            )}
            {filtered.map((target) => (
              <button
                key={`${target.contactId}-${target.label}`}
                type="button"
                onClick={() => setSelectedId(target.contactId)}
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground",
                  selectedId === target.contactId && "bg-accent"
                )}
              >
                <span className="truncate">
                  {target.label}
                  {target.sublabel && (
                    <span className="text-muted-foreground"> — {target.sublabel}</span>
                  )}
                </span>
                {selectedId === target.contactId && (
                  <Check size={14} strokeWidth={1.75} className="shrink-0" />
                )}
              </button>
            ))}
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>
            Cancelar
          </DialogClose>
          <Button type="button" disabled={!selectedId || isPending} onClick={handleSubmit}>
            {isPending ? "Vinculando..." : "Vincular"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

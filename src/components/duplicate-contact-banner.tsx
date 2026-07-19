"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export type DuplicateContactInfo = {
  id: string;
  name: string;
  matchedField: "telefone" | "email";
};

// Aviso reaproveitado em todo lugar que um contato aparece (card do
// contato, negócio, cabeçalho do Atendimento — decisão explícita do
// usuário) quando o telefone ou email dele também pertence a outro
// contato. Cobre duplicatas que já existiam antes da checagem em
// criação/edição (ver findDuplicateContact) ter entrado — essas nunca
// desaparecem sozinhas, alguém precisa decidir mesclar ou ignorar.
export function DuplicateContactBanner({
  contactId,
  duplicate,
}: {
  contactId: string;
  duplicate: DuplicateContactInfo;
}) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  async function handleMerge() {
    setIsPending(true);
    setError(null);
    try {
      const res = await fetch("/api/contacts/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceContactId: duplicate.id,
          targetContactId: contactId,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Falha ao mesclar contatos.");
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao mesclar contatos.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-status-warning/40 bg-status-warning/10 px-3 py-2 text-sm">
      <TriangleAlert size={14} strokeWidth={1.75} className="shrink-0 text-status-warning" />
      <span className="min-w-0 flex-1">
        Esse {duplicate.matchedField} também pertence a{" "}
        <span className="font-medium">{duplicate.name}</span> — pode ser o mesmo
        contato duplicado.
      </span>
      <Button type="button" size="sm" disabled={isPending} onClick={handleMerge}>
        {isPending ? "Mesclando..." : "Mesclar contatos"}
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={() => setDismissed(true)}>
        Ignorar
      </Button>
      {error && <p className="w-full text-xs text-destructive">{error}</p>}
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { syncMeetingNotesAction } from "../actions";

export function SyncMeetingNotesButton({ dealId }: { dealId: string }) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  async function handleClick() {
    setIsPending(true);
    const result = await syncMeetingNotesAction(dealId);
    setIsPending(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    if (result.created > 0) {
      toast.success(
        `${result.created} reunião${result.created > 1 ? "ões" : ""} nova${result.created > 1 ? "s" : ""} sincronizada${result.created > 1 ? "s" : ""}.`
      );
      router.refresh();
    } else if (result.permissionError) {
      // Achou reunião(ões) mas a leitura da nota falhou por permissão do
      // Drive — nunca deixa isso parecer "não achei nada" (bug real
      // encontrado: conexão feita antes do escopo drive.readonly existir).
      toast.error(
        "Encontrei reunião(ões), mas não consegui ler as notas — a permissão de acesso ao Google Drive expirou ou nunca foi concedida. Reconecte o Google Agenda em Meu Perfil e tente de novo."
      );
    } else {
      toast.info("Nenhuma reunião nova encontrada pra este negócio.");
    }
  }

  return (
    <Button type="button" variant="outline" size="sm" disabled={isPending} onClick={handleClick}>
      <RefreshCw size={14} strokeWidth={1.75} className={isPending ? "animate-spin" : ""} />
      {isPending ? "Sincronizando..." : "Sincronizar reuniões"}
    </Button>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { MarkLostDialog } from "@/components/mark-lost-dialog";
import { setDealLostAction, setDealStatusAction } from "../actions";

export function DealStatusActions({
  dealId,
  status,
  lossReasons,
}: {
  dealId: string;
  status: "aberto" | "ganho" | "perdido";
  lossReasons: { id: string; label: string }[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [isPending, setIsPending] = useState(false);
  const [lostDialogOpen, setLostDialogOpen] = useState(false);

  function handleSetStatus(next: "aberto" | "ganho") {
    setIsPending(true);
    startTransition(async () => {
      await setDealStatusAction(dealId, next);
      setIsPending(false);
      router.refresh();
    });
  }

  async function handleSetLost(lossReasonId: string) {
    await setDealLostAction(dealId, lossReasonId);
    router.refresh();
  }

  return (
    <div className="flex flex-wrap gap-2">
      {status !== "ganho" && (
        <Button
          type="button"
          variant="outline"
          disabled={isPending}
          onClick={() => handleSetStatus("ganho")}
        >
          Marcar Ganho
        </Button>
      )}
      {status !== "perdido" && (
        <Button
          type="button"
          variant="outline"
          disabled={isPending}
          onClick={() => setLostDialogOpen(true)}
        >
          Marcar Perdido
        </Button>
      )}
      {status !== "aberto" && (
        <Button
          type="button"
          variant="outline"
          disabled={isPending}
          onClick={() => handleSetStatus("aberto")}
        >
          Reabrir
        </Button>
      )}
      <MarkLostDialog
        open={lostDialogOpen}
        onOpenChange={setLostDialogOpen}
        reasons={lossReasons}
        onConfirm={handleSetLost}
      />
    </div>
  );
}

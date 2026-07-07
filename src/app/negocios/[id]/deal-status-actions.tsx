"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { setDealStatusAction } from "../actions";

export function DealStatusActions({
  dealId,
  status,
}: {
  dealId: string;
  status: "aberto" | "ganho" | "perdido";
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [isPending, setIsPending] = useState(false);

  function handleSetStatus(next: "aberto" | "ganho" | "perdido") {
    setIsPending(true);
    startTransition(async () => {
      await setDealStatusAction(dealId, next);
      setIsPending(false);
      router.refresh();
    });
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
          onClick={() => handleSetStatus("perdido")}
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
    </div>
  );
}

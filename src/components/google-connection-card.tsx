"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";

export function GoogleConnectionCard({
  connected,
  connectedAt,
  sharedByName,
  onDisconnect,
}: {
  connected: boolean;
  connectedAt: string | null;
  sharedByName: string | null;
  onDisconnect: () => Promise<{ ok: boolean }>;
}) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  async function handleDisconnect() {
    setIsPending(true);
    await onDisconnect();
    setIsPending(false);
    router.refresh();
  }

  if (connected) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Badge variant="success">Conectado</Badge>
          {connectedAt && (
            <span className="text-sm text-muted-foreground">
              desde {new Date(connectedAt).toLocaleDateString("pt-BR")}
            </span>
          )}
        </div>
        <Button type="button" variant="outline" size="sm" disabled={isPending} onClick={handleDisconnect}>
          {isPending ? "Desconectando..." : "Desconectar"}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sharedByName ? (
        <p className="text-sm text-muted-foreground">
          Você está usando a agenda compartilhada por <strong>{sharedByName}</strong>. Se
          preferir, também pode conectar a sua própria conta.
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          Conecte sua conta Google (@viagente.com.br) pra criar eventos de verdade no Google
          Agenda direto pelo CRM, sem precisar copiar link nenhum.
        </p>
      )}
      {/* <a> proposital em vez de <Link>: rota de API que redireciona pro
          Google, não uma página — o prefetch do Link dispararia essa rota
          (e gravaria o cookie de state do OAuth) só de passar o mouse em cima. */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- ver comentário acima */}
      <a href="/api/auth/google/connect" className={buttonVariants({ variant: "default", size: "sm" })}>
        Conectar Google Agenda
      </a>
    </div>
  );
}

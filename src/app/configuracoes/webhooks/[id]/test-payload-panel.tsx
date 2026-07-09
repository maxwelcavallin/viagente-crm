"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { testInboundWebhookAction, type TestWebhookResult } from "../actions";

const EXAMPLE_PAYLOAD = `{
  "nome": "Maria Silva",
  "whatsapp": "5511999998888",
  "email": "maria@exemplo.com",
  "answers": {
    "gasto_cartao": 25000,
    "frequencia_viagens": 4
  }
}`;

export function TestPayloadPanel({ webhookId }: { webhookId: string }) {
  const router = useRouter();
  const [payloadText, setPayloadText] = useState(EXAMPLE_PAYLOAD);
  const [isPending, setIsPending] = useState(false);
  const [result, setResult] = useState<TestWebhookResult | null>(null);

  async function handleTest() {
    setIsPending(true);
    const res = await testInboundWebhookAction(webhookId, payloadText);
    setIsPending(false);
    setResult(res);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <textarea
        value={payloadText}
        onChange={(e) => setPayloadText(e.target.value)}
        rows={10}
        className="w-full rounded-lg border border-input bg-transparent p-2.5 font-mono text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20"
      />
      <Button type="button" onClick={handleTest} disabled={isPending}>
        {isPending ? "Testando..." : "Enviar payload de teste"}
      </Button>

      {result?.status === "error" && (
        <p className="text-sm text-destructive">{result.message}</p>
      )}
      {result?.status === "result" && (
        <div className="space-y-1 rounded-lg border border-border p-3 text-sm">
          {result.result.ok ? (
            <>
              <p className="font-medium text-status-success">
                Contato e negócio criados com sucesso.
              </p>
              <p>
                Contato: <code className="font-mono text-xs">{result.result.contactId}</code>
              </p>
              <p>
                Negócio: <code className="font-mono text-xs">{result.result.dealId}</code>
              </p>
              <p>Temperatura: {result.result.temperature ?? "—"}</p>
              {result.result.missingFields.length > 0 && (
                <p className="text-status-warning">
                  Campos não resolvidos no payload: {result.result.missingFields.join(", ")}
                </p>
              )}
            </>
          ) : (
            <>
              <p className="font-medium text-destructive">{result.result.error}</p>
              {result.result.missingFields.length > 0 && (
                <p className="text-muted-foreground">
                  Campos não resolvidos: {result.result.missingFields.join(", ")}
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

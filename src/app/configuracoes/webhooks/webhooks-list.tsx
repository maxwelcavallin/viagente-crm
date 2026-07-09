"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Webhook } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toggleWebhookActiveAction } from "./actions";

export type WebhookRow = {
  id: string;
  name: string;
  direction: "entrada" | "saida";
  active: boolean;
  targetUrl: string | null;
  events: string[];
  defaultPipelineId: string | null;
  defaultStageId: string | null;
  pipelineId: string | null;
  stageId: string | null;
};

const EVENT_LABELS: Record<string, string> = {
  negocio_criado: "Negócio criado",
  etapa_alterada: "Etapa alterada",
  negocio_ganho: "Negócio ganho",
  negocio_perdido: "Negócio perdido",
};

function ActiveToggle({ webhook }: { webhook: WebhookRow }) {
  const router = useRouter();
  const [active, setActive] = useState(webhook.active);
  const [isPending, setIsPending] = useState(false);

  async function handleChange(next: boolean) {
    setActive(next);
    setIsPending(true);
    const result = await toggleWebhookActiveAction(webhook.id, next);
    setIsPending(false);
    if (!result.ok) setActive(!next);
    else router.refresh();
  }

  return <Switch checked={active} onCheckedChange={handleChange} disabled={isPending} />;
}

export function WebhooksList({
  webhooks,
  pipelines,
  stages,
}: {
  webhooks: WebhookRow[];
  pipelines: { id: string; name: string }[];
  stages: { id: string; name: string; pipelineId: string }[];
}) {
  const pipelineById = new Map(pipelines.map((p) => [p.id, p]));
  const stageById = new Map(stages.map((s) => [s.id, s]));

  if (webhooks.length === 0) {
    return (
      <EmptyState
        icon={Webhook}
        title="Nenhum webhook cadastrado"
        description="Crie um webhook de entrada ou saída pelos botões acima."
      />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Direção</TableHead>
          <TableHead>Nome</TableHead>
          <TableHead>Detalhe</TableHead>
          <TableHead>Ativo</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {webhooks.map((webhook) => (
          <TableRow key={webhook.id}>
            <TableCell>
              <Badge variant={webhook.direction === "entrada" ? "info" : "secondary"}>
                {webhook.direction === "entrada" ? "Entrada" : "Saída"}
              </Badge>
            </TableCell>
            <TableCell>
              <Link
                href={`/configuracoes/webhooks/${webhook.id}`}
                className="font-medium text-primary hover:underline"
              >
                {webhook.name}
              </Link>
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {webhook.direction === "entrada" ? (
                <>
                  {pipelineById.get(webhook.defaultPipelineId ?? "")?.name ?? "—"} →{" "}
                  {stageById.get(webhook.defaultStageId ?? "")?.name ?? "—"}
                </>
              ) : (
                <div className="flex flex-wrap items-center gap-1">
                  <span className="truncate max-w-[220px]">{webhook.targetUrl}</span>
                  {webhook.events.map((e) => (
                    <Badge key={e} variant="secondary">
                      {EVENT_LABELS[e] ?? e}
                    </Badge>
                  ))}
                  {webhook.pipelineId && (
                    <Badge variant="outline">
                      {pipelineById.get(webhook.pipelineId)?.name}
                      {webhook.stageId ? ` → ${stageById.get(webhook.stageId)?.name}` : ""}
                    </Badge>
                  )}
                </div>
              )}
            </TableCell>
            <TableCell>
              <ActiveToggle webhook={webhook} />
            </TableCell>
            <TableCell>
              <Link
                href={`/configuracoes/webhooks/${webhook.id}`}
                className="text-sm text-primary hover:underline"
              >
                Ver detalhes
              </Link>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

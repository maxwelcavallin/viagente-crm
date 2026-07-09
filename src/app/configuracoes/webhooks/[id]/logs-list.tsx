"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { History } from "lucide-react";

export type LogRow = {
  id: string;
  status: "sucesso" | "erro";
  errorMessage: string | null;
  payload: unknown;
  createdAt: Date;
};

function LogRowItem({ log }: { log: LogRow }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border border-border p-3 text-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full flex-wrap items-center justify-between gap-2 text-left"
      >
        <div className="flex items-center gap-2">
          <Badge variant={log.status === "sucesso" ? "success" : "danger"}>
            {log.status === "sucesso" ? "Sucesso" : "Erro"}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {new Intl.DateTimeFormat("pt-BR", {
              dateStyle: "short",
              timeStyle: "short",
            }).format(log.createdAt)}
          </span>
        </div>
        <span className="text-xs text-primary">{open ? "Ocultar" : "Ver payload"}</span>
      </button>
      {log.errorMessage && (
        <p className="mt-1 text-xs text-muted-foreground">{log.errorMessage}</p>
      )}
      {open && (
        <pre className="mt-2 max-h-64 overflow-auto rounded-md bg-muted p-2 font-mono text-xs whitespace-pre-wrap">
          {JSON.stringify(log.payload, null, 2)}
        </pre>
      )}
    </div>
  );
}

export function LogsList({ logs }: { logs: LogRow[] }) {
  if (logs.length === 0) {
    return (
      <EmptyState
        icon={History}
        title="Nenhuma execução ainda"
        description="Os disparos deste webhook aparecem aqui."
      />
    );
  }

  return (
    <div className="space-y-2">
      {logs.map((log) => (
        <LogRowItem key={log.id} log={log} />
      ))}
    </div>
  );
}

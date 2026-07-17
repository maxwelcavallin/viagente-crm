"use client";

import { useState, useTransition } from "react";
import { KeyRound } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { toggleApiKeyActiveAction } from "./actions";

export type ApiKeyRow = {
  id: string;
  label: string;
  scopes: string[];
  active: boolean;
  lastUsedAt: string | null;
  createdAt: string;
  createdByName: string;
};

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function KeyRowActions({ id, active }: { id: string; active: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [localActive, setLocalActive] = useState(active);

  function handleToggle() {
    const next = !localActive;
    setLocalActive(next);
    startTransition(async () => {
      const result = await toggleApiKeyActiveAction(id, next);
      if (!result.ok) setLocalActive(!next);
    });
  }

  return (
    <Button
      type="button"
      variant={localActive ? "outline" : "secondary"}
      size="sm"
      disabled={isPending}
      onClick={handleToggle}
    >
      {localActive ? "Revogar" : "Reativar"}
    </Button>
  );
}

export function ApiKeysTable({ apiKeys }: { apiKeys: ApiKeyRow[] }) {
  if (apiKeys.length === 0) {
    return (
      <EmptyState
        icon={KeyRound}
        title="Nenhuma API key criada"
        description="Crie a primeira pelo formulário ao lado."
      />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Rótulo</TableHead>
          <TableHead>Escopo</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Último uso</TableHead>
          <TableHead>Criada por</TableHead>
          <TableHead>Criada em</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {apiKeys.map((key) => (
          <TableRow key={key.id}>
            <TableCell>{key.label}</TableCell>
            <TableCell>
              <Badge variant={key.scopes.includes("escrita") ? "info" : "secondary"}>
                {key.scopes.includes("escrita") ? "Leitura e escrita" : "Somente leitura"}
              </Badge>
            </TableCell>
            <TableCell>
              <Badge variant={key.active ? "success" : "danger"}>
                {key.active ? "Ativa" : "Revogada"}
              </Badge>
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {key.lastUsedAt ? formatDate(key.lastUsedAt) : "Nunca usada"}
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">{key.createdByName}</TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {formatDate(key.createdAt)}
            </TableCell>
            <TableCell>
              <div className="flex justify-end">
                <KeyRowActions id={key.id} active={key.active} />
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

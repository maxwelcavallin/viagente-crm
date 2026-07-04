"use client";

import Link from "next/link";
import { useActionState } from "react";
import { MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  setDefaultChannelAction,
  testConnectionAction,
  type ChannelFormState,
} from "./actions";

export type ChannelRow = {
  id: string;
  label: string;
  phoneNumber: string | null;
  status: "conectado" | "desconectado" | "pendente";
  isDefault: boolean;
  maskedToken: string;
  maskedClientToken: string;
};

const idleState: ChannelFormState = { status: "idle" };

// Nunca usar --primary (dourado) pra status — seção 1 do design system.
function statusVariant(status: ChannelRow["status"]) {
  if (status === "conectado") return "success" as const;
  if (status === "desconectado") return "destructive" as const;
  return "warning" as const;
}

function ChannelRowItem({ channel }: { channel: ChannelRow }) {
  const [testState, testAction, testPending] = useActionState(
    testConnectionAction,
    idleState
  );

  return (
    <TableRow>
      <TableCell>
        <Link href={`/admin/whatsapp/${channel.id}`} className="text-primary hover:underline">
          {channel.label}
        </Link>
        <div className="text-xs text-muted-foreground">
          token {channel.maskedToken} · client-token {channel.maskedClientToken}
        </div>
      </TableCell>
      <TableCell>{channel.phoneNumber ?? "—"}</TableCell>
      <TableCell>
        <Badge variant={statusVariant(channel.status)} dot>
          {channel.status}
        </Badge>
        {testState.status === "error" && (
          <p className="mt-1 text-xs text-destructive">{testState.message}</p>
        )}
      </TableCell>
      <TableCell>
        {channel.isDefault ? (
          <Badge variant="secondary">Padrão</Badge>
        ) : (
          <form action={setDefaultChannelAction}>
            <input type="hidden" name="channelId" value={channel.id} />
            <Button type="submit" variant="outline" size="sm">
              Tornar padrão
            </Button>
          </form>
        )}
      </TableCell>
      <TableCell>
        <form action={testAction}>
          <input type="hidden" name="channelId" value={channel.id} />
          <Button type="submit" variant="outline" size="sm" disabled={testPending}>
            {testPending ? "Testando..." : "Testar conexão"}
          </Button>
        </form>
      </TableCell>
    </TableRow>
  );
}

export function ChannelsList({ channels }: { channels: ChannelRow[] }) {
  if (channels.length === 0) {
    return (
      <EmptyState
        icon={MessageSquare}
        title="Nenhum canal configurado"
        description="Adicione o primeiro canal WhatsApp pelo formulário ao lado."
      />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Canal</TableHead>
          <TableHead>Número</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Padrão</TableHead>
          <TableHead>Conexão</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {channels.map((channel) => (
          <ChannelRowItem key={channel.id} channel={channel} />
        ))}
      </TableBody>
    </Table>
  );
}

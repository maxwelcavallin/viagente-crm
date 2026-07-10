"use client";

import { useState } from "react";
import Link from "next/link";
import { useActionState } from "react";
import { MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  deleteChannelAction,
  setDefaultChannelAction,
  testConnectionAction,
  updateChannelAction,
  type ChannelFormState,
} from "./actions";

export type ChannelRow = {
  id: string;
  label: string;
  phoneNumber: string | null;
  status: "conectado" | "desconectado" | "pendente";
  isDefault: boolean;
  zapiInstanceId: string;
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

function EditChannelDialog({ channel }: { channel: ChannelRow }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(
    updateChannelAction,
    idleState
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button type="button" variant="outline" size="sm" />}>
        Editar
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar canal &quot;{channel.label}&quot;</DialogTitle>
          <DialogDescription>
            Deixe token/client-token em branco pra manter os valores já salvos.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="id" value={channel.id} />
          <div className="space-y-2">
            <Label htmlFor={`edit-label-${channel.id}`}>Nome do canal</Label>
            <Input
              id={`edit-label-${channel.id}`}
              name="label"
              defaultValue={channel.label}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`edit-phone-${channel.id}`}>Número (opcional)</Label>
            <Input
              id={`edit-phone-${channel.id}`}
              name="phoneNumber"
              defaultValue={channel.phoneNumber ?? ""}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`edit-instance-${channel.id}`}>Z-API Instance ID</Label>
            <Input
              id={`edit-instance-${channel.id}`}
              name="zapiInstanceId"
              defaultValue={channel.zapiInstanceId}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`edit-token-${channel.id}`}>Z-API Token (da instância)</Label>
            <Input
              id={`edit-token-${channel.id}`}
              name="zapiToken"
              type="password"
              placeholder={`Atual: ${channel.maskedToken}`}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`edit-client-token-${channel.id}`}>
              Z-API Client-Token (da conta)
            </Label>
            <Input
              id={`edit-client-token-${channel.id}`}
              name="zapiClientToken"
              type="password"
              placeholder={`Atual: ${channel.maskedClientToken}`}
            />
          </div>
          {state.status === "error" && (
            <p className="text-sm text-destructive">{state.message}</p>
          )}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              Cancelar
            </DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteChannelDialog({ channel }: { channel: ChannelRow }) {
  const [state, formAction, isPending] = useActionState(
    deleteChannelAction,
    idleState
  );

  return (
    <Dialog>
      <DialogTrigger render={<Button type="button" variant="destructive" size="sm" />}>
        Excluir
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Excluir o canal &quot;{channel.label}&quot;?</DialogTitle>
          <DialogDescription>
            Mensagens já trocadas por este canal continuam no histórico, mas o canal
            deixa de poder enviar/receber. Essa ação não pode ser desfeita.
          </DialogDescription>
        </DialogHeader>
        {state.status === "error" && (
          <p className="text-sm text-destructive">{state.message}</p>
        )}
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>
            Cancelar
          </DialogClose>
          <form action={formAction}>
            <input type="hidden" name="id" value={channel.id} />
            <Button type="submit" variant="destructive" disabled={isPending}>
              {isPending ? "Excluindo..." : "Confirmar exclusão"}
            </Button>
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ChannelRowItem({ channel }: { channel: ChannelRow }) {
  const [testState, testAction, testPending] = useActionState(
    testConnectionAction,
    idleState
  );

  return (
    <TableRow>
      <TableCell>
        <Link href={`/configuracoes/whatsapp/${channel.id}`} className="text-primary hover:underline">
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
      <TableCell>
        <div className="flex items-center gap-1.5">
          <EditChannelDialog channel={channel} />
          <DeleteChannelDialog channel={channel} />
        </div>
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
          <TableHead>Ações</TableHead>
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

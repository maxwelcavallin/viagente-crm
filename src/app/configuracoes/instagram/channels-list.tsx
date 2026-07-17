"use client";

import { useState } from "react";
import Link from "next/link";
import { useActionState } from "react";
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
import { InstagramIcon } from "@/components/icons/instagram-icon";
import {
  deleteChannelAction,
  renameChannelAction,
  setDefaultChannelAction,
  testConnectionAction,
  type ChannelFormState,
} from "./actions";

export type InstagramChannelRow = {
  id: string;
  label: string;
  username: string | null;
  status: "conectado" | "desconectado" | "pendente";
  isDefault: boolean;
};

const idleState: ChannelFormState = { status: "idle" };

// Nunca usar --primary (dourado) pra status — seção 1 do design system.
function statusVariant(status: InstagramChannelRow["status"]) {
  if (status === "conectado") return "success" as const;
  if (status === "desconectado") return "destructive" as const;
  return "warning" as const;
}

function RenameChannelDialog({ channel }: { channel: InstagramChannelRow }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(renameChannelAction, idleState);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button type="button" variant="outline" size="sm" />}>
        Renomear
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Renomear canal</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="id" value={channel.id} />
          <div className="space-y-2">
            <Label htmlFor={`ig-label-${channel.id}`}>Nome do canal</Label>
            <Input
              id={`ig-label-${channel.id}`}
              name="label"
              defaultValue={channel.label}
              required
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

function DeleteChannelDialog({ channel }: { channel: InstagramChannelRow }) {
  const [state, formAction, isPending] = useActionState(deleteChannelAction, idleState);

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

function ChannelRowItem({ channel }: { channel: InstagramChannelRow }) {
  const [testState, testAction, testPending] = useActionState(testConnectionAction, idleState);

  return (
    <TableRow>
      <TableCell>
        <Link
          href={`/configuracoes/instagram/${channel.id}`}
          className="text-primary hover:underline"
        >
          {channel.label}
        </Link>
        {channel.username && (
          <div className="text-xs text-muted-foreground">@{channel.username}</div>
        )}
      </TableCell>
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
          <RenameChannelDialog channel={channel} />
          <DeleteChannelDialog channel={channel} />
        </div>
      </TableCell>
    </TableRow>
  );
}

export function ChannelsList({ channels }: { channels: InstagramChannelRow[] }) {
  if (channels.length === 0) {
    return (
      <EmptyState
        icon={InstagramIcon}
        title="Nenhuma conta conectada"
        description="Conecte a primeira conta do Instagram pelo botão ao lado."
      />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Canal</TableHead>
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

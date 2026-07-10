"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { updateUserAction, type UpdateUserState } from "./actions";

const idleState: UpdateUserState = { status: "idle" };

export function EditUserDialog({
  user,
}: {
  user: {
    id: string;
    name: string;
    email: string;
    role: "admin" | "atendente";
    restrictToOwnRecords: boolean;
  };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<"admin" | "atendente">(user.role);
  const [restrictToOwnRecords, setRestrictToOwnRecords] = useState(
    user.restrictToOwnRecords
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(formData: FormData) {
    setIsPending(true);
    setError(null);
    const result = await updateUserAction(idleState, formData);
    setIsPending(false);
    if (result.status === "error") {
      setError(result.message);
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setRole(user.role);
          setRestrictToOwnRecords(user.restrictToOwnRecords);
          setError(null);
        }
      }}
    >
      <DialogTrigger render={<Button type="button" variant="outline" size="sm" />}>
        Editar
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar {user.name}</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <input type="hidden" name="id" value={user.id} />
          <div className="space-y-2">
            <Label htmlFor={`edit-name-${user.id}`}>Nome</Label>
            <Input id={`edit-name-${user.id}`} name="name" defaultValue={user.name} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`edit-email-${user.id}`}>Email</Label>
            <Input
              id={`edit-email-${user.id}`}
              name="email"
              type="email"
              defaultValue={user.email}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`edit-role-${user.id}`}>Role</Label>
            <input type="hidden" name="role" value={role} />
            <Select
              value={role}
              onValueChange={(v) => setRole((v as "admin" | "atendente") ?? "atendente")}
              items={{ atendente: "Atendente", admin: "Admin" }}
            >
              <SelectTrigger id={`edit-role-${user.id}`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="atendente">Atendente</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor={`edit-restrict-${user.id}`}>
                Restringir aos próprios negócios/atendimentos
              </Label>
              <p className="text-xs text-muted-foreground">
                Se ligado, esse usuário só vê negócios e atendimentos dele mesmo ou sem
                dono — nunca os de outros atendentes.
              </p>
            </div>
            <input
              type="hidden"
              name="restrictToOwnRecords"
              value={String(restrictToOwnRecords)}
            />
            <Switch
              id={`edit-restrict-${user.id}`}
              checked={restrictToOwnRecords}
              onCheckedChange={setRestrictToOwnRecords}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
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

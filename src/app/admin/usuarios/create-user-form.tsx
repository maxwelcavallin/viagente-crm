"use client";

import { useActionState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createUserAction, type CreateUserState } from "./actions";

const initialState: CreateUserState = { status: "idle" };

export function CreateUserForm() {
  const [state, formAction, isPending] = useActionState(
    createUserAction,
    initialState
  );
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  if (state.status === "success") {
    return (
      <div className="space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm dark:border-amber-900 dark:bg-amber-950">
        <p className="font-medium">
          Usuário {state.name} criado. Copie a senha temporária agora — ela
          não será mostrada de novo.
        </p>
        <div className="space-y-1">
          <p>
            <span className="text-muted-foreground">Email:</span>{" "}
            {state.email}
          </p>
          <p className="flex items-center gap-2">
            <span className="text-muted-foreground">Senha temporária:</span>
            <code className="rounded bg-background px-2 py-1 font-mono">
              {state.tempPassword}
            </code>
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={() => {
            formRef.current?.reset();
            router.refresh();
          }}
        >
          Fechar e criar outro
        </Button>
      </div>
    );
  }

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Nome</Label>
        <Input id="name" name="name" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="role">Role</Label>
        <Select name="role" defaultValue="atendente">
          <SelectTrigger id="role" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="atendente">Atendente</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {state.status === "error" && (
        <p className="text-sm text-destructive">{state.message}</p>
      )}
      <Button type="submit" disabled={isPending}>
        {isPending ? "Criando..." : "Criar usuário"}
      </Button>
    </form>
  );
}

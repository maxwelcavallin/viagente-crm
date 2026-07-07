"use client";

import { useActionState, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { TriangleAlert } from "lucide-react";
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
  const [role, setRole] = useState("atendente");

  if (state.status === "success") {
    return (
      <div className="space-y-3 rounded-lg border-l-[3px] border-status-warning bg-status-warning/10 p-4 text-sm">
        <p className="flex items-start gap-2 font-medium">
          <TriangleAlert
            size={16}
            strokeWidth={1.75}
            className="mt-0.5 shrink-0 text-status-warning"
          />
          <span>
            Usuário {state.name} criado. Copie a senha temporária agora — ela
            não será mostrada de novo.
          </span>
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
        <input type="hidden" name="role" value={role} />
        <Select
          value={role}
          onValueChange={(v) => setRole(v ?? "atendente")}
          items={{ atendente: "Atendente", admin: "Admin" }}
        >
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

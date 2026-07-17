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
import { createApiKeyAction, type CreateApiKeyState } from "./actions";

const initialState: CreateApiKeyState = { status: "idle" };

export function CreateApiKeyForm() {
  const [state, formAction, isPending] = useActionState(createApiKeyAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const [scope, setScope] = useState("leitura");

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
            Chave &quot;{state.label}&quot; criada. Copie agora — ela não será mostrada de novo.
          </span>
        </p>
        <code className="block break-all rounded bg-background px-2 py-1.5 font-mono text-xs">
          {state.rawKey}
        </code>
        <Button
          type="button"
          size="sm"
          onClick={() => {
            formRef.current?.reset();
            router.refresh();
          }}
        >
          Fechar e criar outra
        </Button>
      </div>
    );
  }

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="label">Nome / rótulo</Label>
        <Input id="label" name="label" placeholder="Ex: Agente de vendas Claude" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="scope">Escopo</Label>
        <input type="hidden" name="scope" value={scope} />
        <Select
          value={scope}
          onValueChange={(v) => setScope(v ?? "leitura")}
          items={{ leitura: "Somente leitura", leitura_escrita: "Leitura e escrita" }}
        >
          <SelectTrigger id="scope" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="leitura">Somente leitura</SelectItem>
            <SelectItem value="leitura_escrita">Leitura e escrita</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {state.status === "error" && <p className="text-sm text-destructive">{state.message}</p>}
      <Button type="submit" disabled={isPending}>
        {isPending ? "Criando..." : "Criar chave"}
      </Button>
    </form>
  );
}

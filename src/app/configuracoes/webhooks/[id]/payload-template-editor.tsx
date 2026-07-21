"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { updatePayloadTemplateAction } from "../actions";

// Mesmo payload que sai por padrão quando nenhum template customizado está
// configurado (ver buildOutboundBody em webhook-outbound.ts) — serve de
// ponto de partida pra quem quiser customizar sem começar do zero.
const DEFAULT_TEMPLATE = `{
  "event": "{{event}}",
  "deal": {
    "id": "{{deal.id}}",
    "title": "{{deal.title}}",
    "value": {{deal.value}},
    "status": "{{deal.status}}",
    "temperature": "{{deal.temperature}}",
    "pipelineId": "{{deal.pipelineId}}",
    "stageId": "{{deal.stageId}}",
    "customFields": {{deal.customFields}}
  },
  "contact": {
    "id": "{{contact.id}}",
    "name": "{{contact.name}}",
    "phone": "{{contact.phone}}",
    "email": "{{contact.email}}"
  }
}`;

const AVAILABLE_PLACEHOLDERS = [
  "{{event}}",
  "{{deal.id}}",
  "{{deal.title}}",
  "{{deal.value}}",
  "{{deal.status}}",
  "{{deal.temperature}}",
  "{{deal.pipelineId}}",
  "{{deal.stageId}}",
  "{{deal.customFields}}",
  "{{contact.id}}",
  "{{contact.name}}",
  "{{contact.phone}}",
  "{{contact.email}}",
  "{{tag.id}}",
  "{{tag.name}}",
];

// Checagem só de sintaxe (não garante que os caminhos existam) — troca cada
// placeholder por "null" e tenta parsear, igual à substituição real faz pra
// valor ausente (ver fillPayloadTemplate). Sinaliza vírgula/chave esquecida
// antes de salvar, sem precisar disparar um evento de verdade pra descobrir.
function isValidJsonSyntax(template: string): boolean {
  if (!template.trim()) return true;
  try {
    JSON.parse(template.replace(/\{\{\s*[\w.]+\s*\}\}/g, "null"));
    return true;
  } catch {
    return false;
  }
}

export function PayloadTemplateEditor({
  webhookId,
  initialTemplate,
}: {
  webhookId: string;
  initialTemplate: string | null;
}) {
  const router = useRouter();
  const [template, setTemplate] = useState(initialTemplate ?? "");
  const [isPending, setIsPending] = useState(false);
  const [saved, setSaved] = useState(false);

  const isValid = isValidJsonSyntax(template);

  async function handleSave() {
    setIsPending(true);
    const result = await updatePayloadTemplateAction(webhookId, template);
    setIsPending(false);
    if (result.ok) {
      setSaved(true);
      router.refresh();
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Deixe em branco pra usar o formato padrão (o mesmo que aparece abaixo). Pra
        customizar, escreva o JSON exatamente como deve sair, usando{" "}
        <code className="font-mono text-xs">{"{{caminho}}"}</code> onde quiser um
        valor do evento.
      </p>
      <div className="space-y-1">
        <Label htmlFor="payload-template" className="text-xs">
          Formato do payload (JSON)
        </Label>
        <textarea
          id="payload-template"
          value={template}
          onChange={(e) => {
            setSaved(false);
            setTemplate(e.target.value);
          }}
          placeholder={DEFAULT_TEMPLATE}
          rows={14}
          spellCheck={false}
          className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 font-mono text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20"
        />
        {!isValid && (
          <p className="text-xs text-destructive">
            JSON inválido — confira vírgulas e chaves antes de salvar.
          </p>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {AVAILABLE_PLACEHOLDERS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => {
              setSaved(false);
              setTemplate((prev) => prev + p);
            }}
            className="rounded-md border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground hover:border-primary/60 hover:text-foreground"
          >
            {p}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <Button
          type="button"
          onClick={() => {
            setSaved(false);
            setTemplate(DEFAULT_TEMPLATE);
          }}
          variant="outline"
        >
          Usar padrão como ponto de partida
        </Button>
        <Button type="button" onClick={handleSave} disabled={isPending || !isValid}>
          {isPending ? "Salvando..." : "Salvar formato"}
        </Button>
        {saved && <span className="text-sm text-status-success">Salvo.</span>}
      </div>
    </div>
  );
}

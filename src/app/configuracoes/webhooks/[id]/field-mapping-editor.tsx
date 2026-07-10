"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldQuickCreate } from "@/components/field-quick-create";
import { CONTACT_SYSTEM_FIELDS } from "@/lib/webhook-fields";
import type { FieldDef } from "@/lib/custom-fields";
import { updateFieldMappingAction } from "../actions";

export function FieldMappingEditor({
  webhookId,
  initialMapping,
  contactFieldDefs,
  dealFieldDefs,
}: {
  webhookId: string;
  initialMapping: Record<string, string>;
  contactFieldDefs: FieldDef[];
  dealFieldDefs: FieldDef[];
}) {
  const router = useRouter();
  const [mapping, setMapping] = useState<Record<string, string>>(initialMapping);
  const [contactFields, setContactFields] = useState(contactFieldDefs);
  const [dealFields, setDealFields] = useState(dealFieldDefs);
  const [isPending, setIsPending] = useState(false);
  const [saved, setSaved] = useState(false);

  function setPath(key: string, path: string) {
    setSaved(false);
    setMapping((prev) => ({ ...prev, [key]: path }));
  }

  async function handleSave() {
    setIsPending(true);
    const cleaned = Object.fromEntries(
      Object.entries(mapping).filter(([, v]) => v.trim())
    );
    const result = await updateFieldMappingAction(webhookId, cleaned);
    setIsPending(false);
    if (result.ok) {
      setSaved(true);
      router.refresh();
    }
  }

  const systemRows = CONTACT_SYSTEM_FIELDS.map((f) => ({ key: f.key, label: f.label }));

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        {systemRows.map((row) => (
          <div key={row.key} className="space-y-1">
            <Label htmlFor={`map-${row.key}`} className="text-xs">
              {row.label}
            </Label>
            <Input
              id={`map-${row.key}`}
              value={mapping[row.key] ?? ""}
              onChange={(e) => setPath(row.key, e.target.value)}
              placeholder="ex: payload.nome"
              className="font-mono text-xs"
            />
          </div>
        ))}
        {contactFields.map((f) => {
          const key = `contact.custom.${f.key}`;
          return (
            <div key={key} className="space-y-1">
              <Label htmlFor={`map-${key}`} className="text-xs">
                {f.label} (contato)
              </Label>
              <Input
                id={`map-${key}`}
                value={mapping[key] ?? ""}
                onChange={(e) => setPath(key, e.target.value)}
                placeholder="ex: payload.nome"
                className="font-mono text-xs"
              />
            </div>
          );
        })}
        {dealFields.map((f) => {
          const key = `deal.custom.${f.key}`;
          return (
            <div key={key} className="space-y-1">
              <Label htmlFor={`map-${key}`} className="text-xs">
                {f.label} (negócio)
              </Label>
              <Input
                id={`map-${key}`}
                value={mapping[key] ?? ""}
                onChange={(e) => setPath(key, e.target.value)}
                placeholder="ex: payload.nome"
                className="font-mono text-xs"
              />
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-4">
        <FieldQuickCreate
          entity="contact"
          onFieldCreated={(field) => setContactFields((prev) => [...prev, field])}
        />
        <FieldQuickCreate
          entity="deal"
          onFieldCreated={(field) => setDealFields((prev) => [...prev, field])}
        />
      </div>
      <div className="flex items-center gap-3">
        <Button type="button" onClick={handleSave} disabled={isPending}>
          {isPending ? "Salvando..." : "Salvar mapeamento"}
        </Button>
        {saved && <span className="text-sm text-status-success">Salvo.</span>}
      </div>
    </div>
  );
}

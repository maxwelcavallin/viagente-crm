"use client";

import { useActionState, useState } from "react";
import { Plus, X } from "lucide-react";
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
import { createFieldAction, type FieldFormState } from "./actions";

const initialState: FieldFormState = { status: "idle" };

const TYPE_LABELS: Record<string, string> = {
  texto: "Texto",
  numero: "Número",
  select: "Select",
  data: "Data",
};

const ENTITY_LABELS: Record<string, string> = {
  contact: "Contato",
  deal: "Negócio",
};

const DIACRITICS_PATTERN = new RegExp("[\\u0300-\\u036f]", "g");

function slugify(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(DIACRITICS_PATTERN, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function CreateFieldForm() {
  const [state, formAction, isPending] = useActionState(
    createFieldAction,
    initialState
  );
  const [label, setLabel] = useState("");
  const [key, setKey] = useState("");
  const [keyTouched, setKeyTouched] = useState(false);
  const [type, setType] = useState<string>("texto");
  const [options, setOptions] = useState<
    { value: string; label: string; valueTouched: boolean }[]
  >([]);

  function handleLabelChange(value: string) {
    setLabel(value);
    if (!keyTouched) setKey(slugify(value));
  }

  function addOption() {
    setOptions((prev) => [...prev, { value: "", label: "", valueTouched: false }]);
  }

  function updateOption(
    index: number,
    patch: Partial<{ value: string; label: string; valueTouched: boolean }>
  ) {
    setOptions((prev) =>
      prev.map((opt, i) => (i === index ? { ...opt, ...patch } : opt))
    );
  }

  function removeOption(index: number) {
    setOptions((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="entity">Entidade</Label>
        <Select name="entity" defaultValue="contact" items={ENTITY_LABELS}>
          <SelectTrigger id="entity" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="contact">Contato</SelectItem>
            <SelectItem value="deal">Negócio</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="label">Label</Label>
        <Input
          id="label"
          name="label"
          value={label}
          onChange={(e) => handleLabelChange(e.target.value)}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="key">Chave</Label>
        <Input
          id="key"
          name="key"
          value={key}
          onChange={(e) => {
            setKeyTouched(true);
            setKey(e.target.value);
          }}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="type">Tipo</Label>
        <Select
          name="type"
          value={type}
          onValueChange={(value) => setType(value ?? "texto")}
          items={TYPE_LABELS}
        >
          <SelectTrigger id="type" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="texto">Texto</SelectItem>
            <SelectItem value="numero">Número</SelectItem>
            <SelectItem value="select">Select</SelectItem>
            <SelectItem value="data">Data</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {type === "select" && (
        <div className="space-y-2">
          <Label>Opções</Label>
          <input
            type="hidden"
            name="options"
            value={JSON.stringify(
              options.map(({ value, label }) => ({ value, label }))
            )}
          />
          <div className="space-y-2">
            {options.map((opt, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  placeholder="Label"
                  value={opt.label}
                  onChange={(e) => {
                    const nextLabel = e.target.value;
                    updateOption(index, {
                      label: nextLabel,
                      value: opt.valueTouched ? opt.value : slugify(nextLabel),
                    });
                  }}
                  className="flex-1"
                />
                <Input
                  placeholder="valor_interno"
                  value={opt.value}
                  onChange={(e) =>
                    updateOption(index, { value: e.target.value, valueTouched: true })
                  }
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Remover opção"
                  onClick={() => removeOption(index)}
                >
                  <X size={14} strokeWidth={1.75} />
                </Button>
              </div>
            ))}
          </div>
          <Button type="button" variant="outline" size="sm" onClick={addOption}>
            <Plus size={14} strokeWidth={1.75} />
            Adicionar opção
          </Button>
        </div>
      )}
      {state.status === "error" && (
        <p className="text-sm text-destructive">{state.message}</p>
      )}
      <Button type="submit" disabled={isPending}>
        {isPending ? "Criando..." : "Criar campo"}
      </Button>
    </form>
  );
}

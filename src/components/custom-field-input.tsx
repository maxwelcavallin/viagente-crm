"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { FieldDef } from "@/lib/custom-fields";

// O Select do Base UI decide se é controlado ou não já no primeiro render,
// olhando se `value` é `undefined` (ver useControlled: `controlled !==
// undefined` fica travado num useRef) — passar `value={x || undefined}`
// quando `x` começa vazio faz o componente "travar" como não controlado pra
// sempre, e o Select visualmente mostra a seleção mas o FormData no submit
// nunca reflete o valor real. Por isso aqui usamos `null` (não `undefined`)
// como sentinela de "vazio": mesmo objeto de config que `defaultValue: null`
// já usa internamente, garante `isControlled = true` desde o primeiro
// render. Cada campo select mantém seu próprio estado controlado + um
// <input type="hidden"> explícito pro FormData.
function SelectCustomFieldInput({
  name,
  defaultValue,
  options,
}: {
  name: string;
  defaultValue: string;
  options: { value: string; label: string }[];
}) {
  const [value, setValue] = useState<string | null>(defaultValue || null);
  const items = Object.fromEntries(options.map((o) => [o.value, o.label]));

  return (
    <>
      <input type="hidden" name={name} value={value ?? ""} />
      <Select
        value={value}
        onValueChange={(v) => setValue(v ?? null)}
        items={items}
      >
        <SelectTrigger id={name} className="w-full">
          <SelectValue placeholder="Selecione..." />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  );
}

export function CustomFieldInput({
  field,
  defaultValue,
}: {
  field: FieldDef;
  defaultValue: string;
}) {
  const name = `custom_${field.key}`;

  if (field.type === "select") {
    return (
      <SelectCustomFieldInput
        name={name}
        defaultValue={defaultValue}
        options={field.options ?? []}
      />
    );
  }

  if (field.type === "numero") {
    return (
      <Input id={name} name={name} type="number" defaultValue={defaultValue} />
    );
  }

  if (field.type === "data") {
    return (
      <Input id={name} name={name} type="date" defaultValue={defaultValue} />
    );
  }

  return <Input id={name} name={name} type="text" defaultValue={defaultValue} />;
}

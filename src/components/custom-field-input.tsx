"use client";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { FieldDef } from "@/lib/custom-fields";

export function CustomFieldInput({
  field,
  defaultValue,
}: {
  field: FieldDef;
  defaultValue: string;
}) {
  const name = `custom_${field.key}`;

  if (field.type === "select") {
    const items = Object.fromEntries(
      (field.options ?? []).map((o) => [o.value, o.label])
    );
    return (
      <Select name={name} defaultValue={defaultValue || undefined} items={items}>
        <SelectTrigger id={name} className="w-full">
          <SelectValue placeholder="Selecione..." />
        </SelectTrigger>
        <SelectContent>
          {(field.options ?? []).map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
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

"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { formatBrazilianPhoneMask } from "@/lib/phone";

// Input de telefone com máscara "(18) 99679-8226" enquanto digita — o valor
// exibido já é o que normalizePhoneNumber espera receber no submit (ver
// comentário em lib/phone.ts), então nenhum ponto de gravação precisa saber
// que este componente existe.
export function PhoneInput({
  defaultValue,
  ...props
}: Omit<React.ComponentProps<typeof Input>, "defaultValue" | "value"> & {
  defaultValue?: string | null;
}) {
  const [value, setValue] = useState(() => formatBrazilianPhoneMask(defaultValue ?? ""));

  return (
    <Input
      {...props}
      type="tel"
      inputMode="numeric"
      placeholder={props.placeholder ?? "(18) 99679-8226"}
      value={value}
      onChange={(e) => setValue(formatBrazilianPhoneMask(e.target.value))}
    />
  );
}

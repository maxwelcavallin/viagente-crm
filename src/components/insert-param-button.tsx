"use client";

import { useState } from "react";
import { Braces } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export type ContactDealParam = { key: string; label: string; value: string };

// Insere o VALOR JÁ RESOLVIDO (não um placeholder {{}}) — diferente dos
// templates (Configurações > Templates), aqui a mensagem é composta e
// enviada na hora pra um contato específico, então não existe uma etapa de
// substituição depois; o parâmetro precisa entrar como texto final.
export function InsertParamButton({
  params,
  onSelect,
}: {
  params: ContactDealParam[];
  onSelect: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Inserir dado do contato/negócio"
          />
        }
      >
        <Braces size={18} strokeWidth={1.75} />
      </PopoverTrigger>
      <PopoverContent className="w-72">
        {params.length === 0 ? (
          <p className="p-2 text-xs text-muted-foreground">
            Nenhum dado disponível pra este contato.
          </p>
        ) : (
          <div className="max-h-64 space-y-0.5 overflow-y-auto">
            {params.map((param) => (
              <button
                key={param.key}
                type="button"
                onClick={() => {
                  onSelect(param.value);
                  setOpen(false);
                }}
                className="block w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                title={`Inserir "${param.value}"`}
              >
                <span className="block text-xs text-muted-foreground">{param.label}</span>
                <span className="block truncate">{param.value}</span>
              </button>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

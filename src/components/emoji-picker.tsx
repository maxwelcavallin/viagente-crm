"use client";

import { useState } from "react";
import { Smile } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// Conjunto curado dos emojis mais usados em atendimento via WhatsApp — não é
// um picker completo com busca/categorias, é o suficiente pra inserção
// rápida durante a conversa (paridade com o botão de emoji da Clint).
const EMOJIS = [
  "😀", "😂", "😊", "😍", "😘", "🥰", "😉", "😎",
  "🤔", "😅", "😢", "😭", "😡", "🙏", "👍", "👎",
  "👏", "🙌", "💪", "🤝", "✅", "❌", "⭐", "🔥",
  "❤️", "💛", "💚", "💙", "🎉", "✈️", "🌍", "📅",
];

export function EmojiPicker({
  onSelect,
}: {
  onSelect: (emoji: string) => void;
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
            aria-label="Inserir emoji"
          />
        }
      >
        <Smile size={18} strokeWidth={1.75} />
      </PopoverTrigger>
      <PopoverContent className="w-64">
        <div className="grid grid-cols-8 gap-1">
          {EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => {
                onSelect(emoji);
                setOpen(false);
              }}
              className="flex size-7 items-center justify-center rounded-md text-lg hover:bg-muted"
            >
              {emoji}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

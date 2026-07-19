"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

export function HelpSearchForm({ defaultValue }: { defaultValue?: string }) {
  const router = useRouter();
  const [value, setValue] = useState(defaultValue ?? "");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const term = value.trim();
    router.push(term ? `/ajuda?q=${encodeURIComponent(term)}` : "/ajuda");
  }

  return (
    <form onSubmit={handleSubmit} className="relative">
      <Search
        size={16}
        strokeWidth={1.75}
        className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Buscar na Central de Ajuda..."
        className="h-11 pl-9 text-sm"
      />
    </form>
  );
}

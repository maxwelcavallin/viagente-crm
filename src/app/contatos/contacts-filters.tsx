"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TagOption } from "@/lib/tags";

// Sentinelas pro filtro de dono — mesmo padrão de deal-filters.tsx, nunca
// colidem com um uuid real.
export const OWNER_MINE = "__meus__";
export const OWNER_UNASSIGNED = "__sem_dono__";
const ALL_OWNERS = "__todos__";
const ALL_TAGS = "__todas__";

// Filtro é sempre via URL (?q=, ?from=, ?to=, ?tag=, ?owner=, ?dup=) — a
// busca de contatos é feita no servidor (paginação de verdade, ver
// page.tsx), diferente do padrão client-side de DealFiltersBar em Negócios
// (que carrega tudo de uma vez e filtra em memória). Trocar qualquer filtro
// aqui sempre volta pra página 1.
function pushParams(
  router: ReturnType<typeof useRouter>,
  pathname: string,
  current: URLSearchParams,
  patch: Record<string, string | null>
) {
  const next = new URLSearchParams(current);
  for (const [key, value] of Object.entries(patch)) {
    if (value === null || value === "") next.delete(key);
    else next.set(key, value);
  }
  next.delete("page");
  const query = next.toString();
  router.push(query ? `${pathname}?${query}` : pathname);
}

export function ContactsFilters({
  allTags,
  owners,
  currentUserId,
}: {
  allTags: TagOption[];
  owners: { id: string; name: string }[];
  currentUserId: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Busca em texto tem debounce (evita uma navegação por tecla digitada) —
  // os demais filtros (select/data/switch) já são discretos, aplicam na hora.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (search === (searchParams.get("q") ?? "")) return;
      pushParams(router, pathname, searchParams, { q: search || null });
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  function set(key: string, value: string | null) {
    pushParams(router, pathname, searchParams, { [key]: value });
  }

  const tagValue = searchParams.get("tag") ?? ALL_TAGS;
  const ownerValue = searchParams.get("owner") ?? ALL_OWNERS;
  const dupOnly = searchParams.get("dup") === "1";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative w-full max-w-xs">
        <Search
          size={16}
          strokeWidth={1.75}
          className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome, telefone ou email..."
          className="h-9 pl-8"
        />
      </div>

      <Select
        items={Object.fromEntries([
          [ALL_OWNERS, "Todos os donos"],
          [OWNER_MINE, "Meus contatos"],
          [OWNER_UNASSIGNED, "Sem dono"],
          ...owners.filter((o) => o.id !== currentUserId).map((o) => [o.id, o.name]),
        ])}
        value={ownerValue}
        onValueChange={(value) => set("owner", value === ALL_OWNERS ? null : (value ?? null))}
      >
        <SelectTrigger className="h-9 w-40">
          <SelectValue placeholder="Dono" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_OWNERS}>Todos os donos</SelectItem>
          <SelectItem value={OWNER_MINE}>Meus contatos</SelectItem>
          <SelectItem value={OWNER_UNASSIGNED}>Sem dono</SelectItem>
          {owners
            .filter((o) => o.id !== currentUserId)
            .map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.name}
              </SelectItem>
            ))}
        </SelectContent>
      </Select>

      <Select
        items={{
          [ALL_TAGS]: "Todas as tags",
          ...Object.fromEntries(allTags.map((t) => [t.id, t.name])),
        }}
        value={tagValue}
        onValueChange={(value) => set("tag", value === ALL_TAGS ? null : (value ?? null))}
      >
        <SelectTrigger className="h-9 w-36">
          <SelectValue placeholder="Tag" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_TAGS}>Todas as tags</SelectItem>
          {allTags.map((tag) => (
            <SelectItem key={tag.id} value={tag.id}>
              {tag.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex items-center gap-1.5">
        <Input
          type="date"
          value={searchParams.get("from") ?? ""}
          onChange={(e) => set("from", e.target.value || null)}
          className="h-9 w-36"
          aria-label="Criado a partir de"
        />
        <span className="text-xs text-muted-foreground">até</span>
        <Input
          type="date"
          value={searchParams.get("to") ?? ""}
          onChange={(e) => set("to", e.target.value || null)}
          className="h-9 w-36"
          aria-label="Criado até"
        />
      </div>

      <div className="flex items-center gap-1.5">
        <Label htmlFor="dup-only" className="text-xs whitespace-nowrap">
          Só duplicatas
        </Label>
        <Switch
          id="dup-only"
          checked={dupOnly}
          onCheckedChange={(checked) => set("dup", checked ? "1" : null)}
        />
      </div>
    </div>
  );
}

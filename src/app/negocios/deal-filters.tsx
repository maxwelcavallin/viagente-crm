"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TEMPERATURE_LABELS } from "@/lib/temperature";
import type { TagOption } from "@/lib/tags";

export type DealFiltersState = {
  search: string;
  ownerId: string;
  tagId: string;
  temperature: string;
  status: string;
  createdFrom: string;
  createdTo: string;
};

export const DEFAULT_FILTERS: DealFiltersState = {
  search: "",
  ownerId: "todos",
  tagId: "todas",
  temperature: "todas",
  status: "aberto",
  createdFrom: "",
  createdTo: "",
};

// Sentinelas pro filtro de dono — nunca colidem com um uuid real.
export const OWNER_FILTER_MINE = "__meus__";
export const OWNER_FILTER_UNASSIGNED = "__sem_dono__";

export function DealFiltersBar({
  filters,
  onChange,
  owners,
  allTags,
  currentUserId,
}: {
  filters: DealFiltersState;
  onChange: (next: DealFiltersState) => void;
  owners: { id: string; name: string }[];
  allTags: TagOption[];
  currentUserId: string;
}) {
  function set<K extends keyof DealFiltersState>(key: K, value: DealFiltersState[K]) {
    onChange({ ...filters, [key]: value });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative w-full max-w-xs">
        <Search
          size={16}
          strokeWidth={1.75}
          className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          value={filters.search}
          onChange={(e) => set("search", e.target.value)}
          placeholder="Buscar contato ou título..."
          className="h-9 pl-8"
        />
      </div>

      <Select
        items={{
          aberto: "Abertos",
          ganho: "Ganhos",
          perdido: "Perdidos",
          todos: "Todos",
        }}
        value={filters.status}
        onValueChange={(value) => set("status", value ?? "aberto")}
      >
        <SelectTrigger className="h-9 w-36">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="aberto">Abertos</SelectItem>
          <SelectItem value="ganho">Ganhos</SelectItem>
          <SelectItem value="perdido">Perdidos</SelectItem>
          <SelectItem value="todos">Todos</SelectItem>
        </SelectContent>
      </Select>

      <Select
        items={Object.fromEntries([
          ["todos", "Todos os donos"],
          [OWNER_FILTER_MINE, "Meus negócios"],
          [OWNER_FILTER_UNASSIGNED, "Não atribuído"],
          ...owners.filter((o) => o.id !== currentUserId).map((o) => [o.id, o.name]),
        ])}
        value={filters.ownerId}
        onValueChange={(value) => set("ownerId", value ?? "todos")}
      >
        <SelectTrigger className="h-9 w-44">
          <SelectValue placeholder="Dono" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todos os donos</SelectItem>
          <SelectItem value={OWNER_FILTER_MINE}>Meus negócios</SelectItem>
          <SelectItem value={OWNER_FILTER_UNASSIGNED}>Não atribuído</SelectItem>
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
          todas: "Todas as tags",
          ...Object.fromEntries(allTags.map((t) => [t.id, t.name])),
        }}
        value={filters.tagId}
        onValueChange={(value) => set("tagId", value ?? "todas")}
      >
        <SelectTrigger className="h-9 w-36">
          <SelectValue placeholder="Tag" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todas">Todas as tags</SelectItem>
          {allTags.map((tag) => (
            <SelectItem key={tag.id} value={tag.id}>
              {tag.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        items={{
          todas: "Toda temperatura",
          quente: TEMPERATURE_LABELS.quente,
          morno: TEMPERATURE_LABELS.morno,
          frio: TEMPERATURE_LABELS.frio,
        }}
        value={filters.temperature}
        onValueChange={(value) => set("temperature", value ?? "todas")}
      >
        <SelectTrigger className="h-9 w-40">
          <SelectValue placeholder="Temperatura" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todas">Toda temperatura</SelectItem>
          <SelectItem value="quente">{TEMPERATURE_LABELS.quente}</SelectItem>
          <SelectItem value="morno">{TEMPERATURE_LABELS.morno}</SelectItem>
          <SelectItem value="frio">{TEMPERATURE_LABELS.frio}</SelectItem>
        </SelectContent>
      </Select>

      <div className="flex items-center gap-1.5">
        <Input
          type="date"
          value={filters.createdFrom}
          onChange={(e) => set("createdFrom", e.target.value)}
          className="h-9 w-36"
          aria-label="Criado a partir de"
        />
        <span className="text-xs text-muted-foreground">até</span>
        <Input
          type="date"
          value={filters.createdTo}
          onChange={(e) => set("createdTo", e.target.value)}
          className="h-9 w-36"
          aria-label="Criado até"
        />
      </div>
    </div>
  );
}

export function matchesDealFilters(
  deal: {
    title: string;
    contactName: string;
    ownerId: string | null;
    tagIds: string[];
    temperature: string | null;
    status: string;
    createdAt: Date;
  },
  filters: DealFiltersState,
  currentUserId: string
): boolean {
  if (filters.status !== "todos" && deal.status !== filters.status) return false;
  if (filters.ownerId === OWNER_FILTER_MINE) {
    if (deal.ownerId !== currentUserId) return false;
  } else if (filters.ownerId === OWNER_FILTER_UNASSIGNED) {
    if (deal.ownerId !== null) return false;
  } else if (filters.ownerId !== "todos" && deal.ownerId !== filters.ownerId) {
    return false;
  }
  if (filters.tagId !== "todas" && !deal.tagIds.includes(filters.tagId)) return false;
  if (filters.temperature !== "todas" && deal.temperature !== filters.temperature)
    return false;
  if (filters.createdFrom && deal.createdAt < new Date(filters.createdFrom))
    return false;
  if (filters.createdTo) {
    const to = new Date(filters.createdTo);
    to.setHours(23, 59, 59, 999);
    if (deal.createdAt > to) return false;
  }
  const term = filters.search.trim().toLowerCase();
  if (term) {
    const matches =
      deal.title.toLowerCase().includes(term) ||
      deal.contactName.toLowerCase().includes(term);
    if (!matches) return false;
  }
  return true;
}

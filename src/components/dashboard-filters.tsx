"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ALL_PIPELINES = "__todas__";
const ALL_TAGS = "__todas__";

export function DashboardFilters({
  pipelines,
  tags,
  pipelineId,
  tagId,
}: {
  pipelines: { id: string; name: string }[];
  tags: { id: string; name: string }[];
  pipelineId: string | null;
  tagId: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === ALL_PIPELINES || value === ALL_TAGS) params.delete(key);
    else params.set(key, value);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        items={Object.fromEntries([
          [ALL_PIPELINES, "Todas as pipelines"],
          ...pipelines.map((p) => [p.id, p.name]),
        ])}
        value={pipelineId ?? ALL_PIPELINES}
        onValueChange={(v) => updateParam("pipelineId", v ?? ALL_PIPELINES)}
      >
        <SelectTrigger className="w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_PIPELINES}>Todas as pipelines</SelectItem>
          {pipelines.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        items={Object.fromEntries([
          [ALL_TAGS, "Todas as tags"],
          ...tags.map((t) => [t.id, t.name]),
        ])}
        value={tagId ?? ALL_TAGS}
        onValueChange={(v) => updateParam("tagId", v ?? ALL_TAGS)}
      >
        <SelectTrigger className="w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_TAGS}>Todas as tags</SelectItem>
          {tags.map((t) => (
            <SelectItem key={t.id} value={t.id}>
              {t.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

"use client";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { TagOption } from "@/lib/tags";

export function TagPicker({
  name = "tagIds",
  allTags,
  selectedTagIds,
  onToggle,
}: {
  name?: string;
  allTags: TagOption[];
  selectedTagIds: Set<string>;
  onToggle: (tagId: string) => void;
}) {
  if (allTags.length === 0) return null;

  return (
    <div className="space-y-2">
      <Label>Tags</Label>
      <div className="flex flex-wrap gap-2">
        {allTags.map((tag) => {
          const selected = selectedTagIds.has(tag.id);
          return (
            <button
              key={tag.id}
              type="button"
              onClick={() => onToggle(tag.id)}
              className={cn(
                "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-colors",
                selected
                  ? "border-transparent bg-accent text-accent-foreground"
                  : "border-border text-muted-foreground hover:bg-muted"
              )}
            >
              <span
                className="size-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: tag.color ?? "currentColor" }}
              />
              {tag.name}
            </button>
          );
        })}
      </div>
      {Array.from(selectedTagIds).map((tagId) => (
        <input key={tagId} type="hidden" name={name} value={tagId} />
      ))}
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Switch } from "@/components/ui/switch";
import { toggleShareAction } from "./actions";

export function ShareWithAttendantsList({
  attendants,
  sharedUserIds,
}: {
  attendants: { id: string; name: string }[];
  sharedUserIds: string[];
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const sharedSet = new Set(sharedUserIds);

  async function handleToggle(id: string, next: boolean) {
    setPendingId(id);
    await toggleShareAction(id, next);
    setPendingId(null);
    router.refresh();
  }

  if (attendants.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Nenhum atendente cadastrado ainda.</p>
    );
  }

  return (
    <div className="space-y-2">
      {attendants.map((attendant) => (
        <div
          key={attendant.id}
          className="flex items-center justify-between rounded-lg border border-border p-2.5"
        >
          <span className="text-sm">{attendant.name}</span>
          <Switch
            checked={sharedSet.has(attendant.id)}
            disabled={pendingId === attendant.id}
            onCheckedChange={(next) => handleToggle(attendant.id, next)}
          />
        </div>
      ))}
    </div>
  );
}

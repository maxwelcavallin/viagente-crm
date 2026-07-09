"use client";

import { useRef, useTransition } from "react";
import { Switch } from "@/components/ui/switch";
import { setChannelAccessAction } from "./actions";

export function AccessToggle({
  channelId,
  userId,
  defaultChecked,
}: {
  channelId: string;
  userId: string;
  defaultChecked: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      ref={formRef}
      action={(formData) => startTransition(() => setChannelAccessAction(formData))}
      className="flex items-center gap-2"
    >
      <input type="hidden" name="channelId" value={channelId} />
      <input type="hidden" name="userId" value={userId} />
      <input
        type="hidden"
        name="hasAccess"
        value={defaultChecked ? "false" : "true"}
      />
      <Switch
        defaultChecked={defaultChecked}
        disabled={isPending}
        onCheckedChange={() => formRef.current?.requestSubmit()}
        aria-label="Tem acesso a este canal"
      />
      <span className="text-sm text-muted-foreground">
        {isPending ? "Salvando..." : defaultChecked ? "Tem acesso" : "Bloqueado"}
      </span>
    </form>
  );
}

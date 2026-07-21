"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { initialOf } from "@/lib/utils";
import { uploadAvatarFile } from "@/lib/upload-avatar-client";
import { removeAvatarAction, updateAvatarAction } from "./actions";

const MAX_SIZE_BYTES = 5 * 1024 * 1024;

export function AvatarSettings({
  name,
  avatarUrl,
}: {
  name: string;
  avatarUrl: string | null;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isPending, setIsPending] = useState(false);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Escolha um arquivo de imagem.");
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      toast.error("A imagem precisa ter até 5 MB.");
      return;
    }

    setIsPending(true);
    try {
      await uploadAvatarFile(file);
      await updateAvatarAction();
      toast.success("Foto de perfil atualizada.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao atualizar a foto.");
    } finally {
      setIsPending(false);
    }
  }

  async function handleRemove() {
    setIsPending(true);
    try {
      await removeAvatarAction();
      toast.success("Foto de perfil removida.");
      router.refresh();
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      <Avatar size="lg">
        {avatarUrl && <AvatarImage src={avatarUrl} alt={name} />}
        <AvatarFallback>{initialOf(name)}</AvatarFallback>
      </Avatar>
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={handleFileChange}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={() => inputRef.current?.click()}
        >
          {isPending ? "Enviando..." : avatarUrl ? "Trocar foto" : "Adicionar foto"}
        </Button>
        {avatarUrl && (
          <Button type="button" variant="ghost" size="sm" disabled={isPending} onClick={handleRemove}>
            Remover
          </Button>
        )}
      </div>
    </div>
  );
}

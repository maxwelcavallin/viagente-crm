"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronUp,
  FileAudio,
  FileText,
  Paperclip,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { AudioRecorderButton } from "@/components/audio-recorder-button";
import { inferMediaKind, type UploadMediaKind } from "@/lib/upload-media-client";
import { substituteTemplate, type TemplateVariableInfo } from "@/lib/templates";
import {
  createTemplateAction,
  updateTemplateAction,
  type TemplateFormState,
} from "./actions";

const idleState: TemplateFormState = { status: "idle" };

export type TemplateItemData = {
  id: string;
  content: string;
  mediaType: string | null;
  mediaFileName: string | null;
};

export type TemplateData = {
  id: string;
  name: string;
  items: TemplateItemData[];
};

type ItemState = {
  id: string;
  content: string;
  mediaType: UploadMediaKind | null;
  mediaFileName: string | null;
  // Preview local (objectURL do arquivo/blob recém-escolhido) tem prioridade
  // sobre a rota de leitura do servidor — evita depender da linha já existir
  // no banco (o id da mensagem é gerado no cliente, então o anexo pode subir
  // pro R2 antes do form ser salvo pela primeira vez).
  localPreviewUrl: string | null;
};

function emptyItem(): ItemState {
  return {
    id: crypto.randomUUID(),
    content: "",
    mediaType: null,
    mediaFileName: null,
    localPreviewUrl: null,
  };
}

async function uploadTemplateMedia(
  itemId: string,
  file: File | Blob,
  contentType: string
): Promise<void> {
  const res = await fetch("/api/templates/upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      itemId,
      type: inferMediaKind(contentType),
      contentType,
    }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "Falha ao preparar upload.");
  }
  const { uploadUrl } = (await res.json()) as { uploadUrl: string };

  const putRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: file,
  });
  if (!putRes.ok) throw new Error("Falha ao enviar o arquivo.");
}

function MessageItemEditor({
  item,
  index,
  total,
  exampleValues,
  onContentChange,
  onFocus,
  onMoveUp,
  onMoveDown,
  onRemove,
  onFileSelected,
  onAudioRecorded,
  onRemoveMedia,
  isUploading,
  uploadError,
}: {
  item: ItemState;
  index: number;
  total: number;
  exampleValues: Record<string, string>;
  onContentChange: (value: string) => void;
  onFocus: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
  onFileSelected: (file: File) => void;
  onAudioRecorded: (blob: Blob, mimeType: string) => void;
  onRemoveMedia: () => void;
  isUploading: boolean;
  uploadError: string | null;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const preview = useMemo(
    () => substituteTemplate(item.content, exampleValues),
    [item.content, exampleValues]
  );
  const previewUrl =
    item.localPreviewUrl ??
    (item.mediaType ? `/api/templates/media/${item.id}` : null);

  return (
    <div className="space-y-2 rounded-lg border border-border p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">
          Mensagem {index + 1}
        </span>
        <div className="flex items-center gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Mover pra cima"
            disabled={index === 0}
            onClick={onMoveUp}
          >
            <ChevronUp size={14} strokeWidth={1.75} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Mover pra baixo"
            disabled={index === total - 1}
            onClick={onMoveDown}
          >
            <ChevronDown size={14} strokeWidth={1.75} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Remover mensagem"
            disabled={total === 1}
            onClick={onRemove}
          >
            <Trash2 size={14} strokeWidth={1.75} />
          </Button>
        </div>
      </div>

      <textarea
        value={item.content}
        onChange={(e) => onContentChange(e.target.value)}
        onFocus={onFocus}
        rows={4}
        placeholder="Texto desta mensagem (opcional se tiver anexo)"
        className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20"
      />
      {preview && (
        <p className="rounded-lg border border-border bg-muted p-2 text-xs whitespace-pre-wrap">
          {preview}
        </p>
      )}

      {item.mediaType ? (
        <div className="space-y-2 rounded-md border border-border p-2.5">
          <div className="flex items-center gap-2">
            {item.mediaType === "audio" ? (
              <FileAudio size={16} strokeWidth={1.75} className="shrink-0 text-muted-foreground" />
            ) : (
              <FileText size={16} strokeWidth={1.75} className="shrink-0 text-muted-foreground" />
            )}
            <span className="min-w-0 flex-1 truncate text-sm">
              {item.mediaType === "audio" ? "Áudio gravado" : item.mediaFileName || "Arquivo anexado"}
            </span>
            <button
              type="button"
              onClick={onRemoveMedia}
              aria-label="Remover anexo"
              className="shrink-0 text-muted-foreground hover:text-foreground"
            >
              <X size={14} strokeWidth={1.75} />
            </button>
          </div>
          {previewUrl && item.mediaType === "audio" && (
            <audio controls src={previewUrl} className="h-8 w-full" />
          )}
          {previewUrl && item.mediaType === "imagem" && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="Preview do anexo" className="max-h-40 rounded-md" />
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isUploading}
            onClick={() => fileInputRef.current?.click()}
          >
            <Paperclip size={13} strokeWidth={1.75} />
            {isUploading ? "Enviando..." : "Anexar arquivo"}
          </Button>
          <AudioRecorderButton onRecorded={onAudioRecorded} disabled={isUploading} />
          <input
            ref={fileInputRef}
            type="file"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) onFileSelected(file);
            }}
          />
        </div>
      )}
      {uploadError && <p className="text-xs text-destructive">{uploadError}</p>}
    </div>
  );
}

export function TemplateFormDialog({
  mode,
  template,
  variableCatalog,
  trigger,
  triggerLabel,
}: {
  mode: "create" | "edit";
  template?: TemplateData;
  variableCatalog: TemplateVariableInfo[];
  trigger: React.ReactElement;
  triggerLabel: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(template?.name ?? "");
  const [items, setItems] = useState<ItemState[]>(() =>
    template && template.items.length > 0
      ? template.items.map((it) => ({
          id: it.id,
          content: it.content,
          mediaType: (it.mediaType as UploadMediaKind | null) ?? null,
          mediaFileName: it.mediaFileName,
          localPreviewUrl: null,
        }))
      : [emptyItem()]
  );
  const [activeItemId, setActiveItemId] = useState<string>(items[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [uploadingItemId, setUploadingItemId] = useState<string | null>(null);
  const [uploadErrorByItem, setUploadErrorByItem] = useState<Record<string, string>>({});
  // Estável durante a vida do diálogo (ver createTemplateAction, que agora
  // exige um id vindo do form).
  const [templateId] = useState(() => template?.id ?? crypto.randomUUID());
  const action = mode === "create" ? createTemplateAction : updateTemplateAction;

  const exampleValues = useMemo(
    () => Object.fromEntries(variableCatalog.map((v) => [v.key, v.example])),
    [variableCatalog]
  );

  function updateItem(id: string, patch: Partial<ItemState>) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }

  function moveItem(id: string, direction: "up" | "down") {
    setItems((prev) => {
      const index = prev.findIndex((it) => it.id === id);
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (index === -1 || targetIndex < 0 || targetIndex >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });
  }

  function removeItem(id: string) {
    setItems((prev) => (prev.length > 1 ? prev.filter((it) => it.id !== id) : prev));
  }

  function addItem() {
    const next = emptyItem();
    setItems((prev) => [...prev, next]);
    setActiveItemId(next.id);
  }

  function insertVariable(key: string) {
    updateItem(activeItemId, {
      content: (items.find((it) => it.id === activeItemId)?.content ?? "") + `{{${key}}}`,
    });
  }

  async function handleFileSelected(itemId: string, file: File) {
    setUploadErrorByItem((prev) => ({ ...prev, [itemId]: "" }));
    setUploadingItemId(itemId);
    try {
      const contentType = file.type || "application/octet-stream";
      await uploadTemplateMedia(itemId, file, contentType);
      updateItem(itemId, {
        mediaType: inferMediaKind(contentType),
        mediaFileName: file.name,
        localPreviewUrl: URL.createObjectURL(file),
      });
    } catch (err) {
      setUploadErrorByItem((prev) => ({
        ...prev,
        [itemId]: err instanceof Error ? err.message : "Falha ao anexar arquivo.",
      }));
    } finally {
      setUploadingItemId(null);
    }
  }

  async function handleAudioRecorded(itemId: string, blob: Blob, mimeType: string) {
    setUploadErrorByItem((prev) => ({ ...prev, [itemId]: "" }));
    setUploadingItemId(itemId);
    try {
      await uploadTemplateMedia(itemId, blob, mimeType);
      updateItem(itemId, {
        mediaType: "audio",
        mediaFileName: null,
        localPreviewUrl: URL.createObjectURL(blob),
      });
    } catch (err) {
      setUploadErrorByItem((prev) => ({
        ...prev,
        [itemId]: err instanceof Error ? err.message : "Falha ao gravar áudio.",
      }));
    } finally {
      setUploadingItemId(null);
    }
  }

  function removeMedia(itemId: string) {
    updateItem(itemId, { mediaType: null, mediaFileName: null, localPreviewUrl: null });
  }

  async function handleSubmit(formData: FormData) {
    setIsPending(true);
    setError(null);
    formData.set(
      "items",
      JSON.stringify(
        items.map((it) => ({
          id: it.id,
          content: it.content,
          mediaType: it.mediaType,
          mediaFileName: it.mediaFileName,
        }))
      )
    );
    const result = await action(idleState, formData);
    setIsPending(false);
    if (result.status === "error") {
      setError(result.message);
      return;
    }
    setOpen(false);
    router.refresh();
  }

  const isUploading = uploadingItemId !== null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger}>{triggerLabel}</DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Novo template" : `Editar ${template?.name}`}
          </DialogTitle>
          <DialogDescription>
            Um template é um conjunto de mensagens separadas, enviadas uma por
            uma na ordem abaixo. Use variáveis no formato{" "}
            <code>{"{{variavel}}"}</code> — a lista está ao lado. Cada
            mensagem precisa de texto e/ou anexo.
          </DialogDescription>
        </DialogHeader>
        <form action={handleSubmit} className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
          <input type="hidden" name="id" value={templateId} />
          <div className="space-y-2">
            <Label htmlFor="name">Nome</Label>
            <Input
              id="name"
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
            <div className="space-y-3">
              {items.map((item, index) => (
                <MessageItemEditor
                  key={item.id}
                  item={item}
                  index={index}
                  total={items.length}
                  exampleValues={exampleValues}
                  onContentChange={(value) => updateItem(item.id, { content: value })}
                  onFocus={() => setActiveItemId(item.id)}
                  onMoveUp={() => moveItem(item.id, "up")}
                  onMoveDown={() => moveItem(item.id, "down")}
                  onRemove={() => removeItem(item.id)}
                  onFileSelected={(file) => handleFileSelected(item.id, file)}
                  onAudioRecorded={(blob, mimeType) => handleAudioRecorded(item.id, blob, mimeType)}
                  onRemoveMedia={() => removeMedia(item.id)}
                  isUploading={uploadingItemId === item.id}
                  uploadError={uploadErrorByItem[item.id] || null}
                />
              ))}
              <Button type="button" variant="outline" size="sm" onClick={addItem}>
                <Plus size={13} strokeWidth={1.75} />
                Adicionar mensagem
              </Button>
            </div>
            <div className="space-y-1">
              <Label>Variáveis disponíveis</Label>
              <p className="text-xs text-muted-foreground">
                Insere na mensagem em foco.
              </p>
              <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
                {variableCatalog.map((v) => (
                  <button
                    key={v.key}
                    type="button"
                    onClick={() => insertVariable(v.key)}
                    className="block w-full rounded-md px-2 py-1 text-left text-xs hover:bg-muted"
                    title={`Inserir {{${v.key}}}`}
                  >
                    <span className="font-mono text-primary">
                      {`{{${v.key}}}`}
                    </span>
                    <span className="block text-muted-foreground">
                      {v.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              Cancelar
            </DialogClose>
            <Button type="submit" disabled={isPending || isUploading}>
              {isPending
                ? "Salvando..."
                : mode === "create"
                  ? "Criar template"
                  : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

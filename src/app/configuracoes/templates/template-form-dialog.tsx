"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileAudio, FileText, Paperclip, X } from "lucide-react";
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

export type TemplateData = {
  id: string;
  name: string;
  content: string;
  mediaType?: string | null;
  mediaFileName?: string | null;
};

async function uploadTemplateMedia(
  templateId: string,
  file: File | Blob,
  contentType: string
): Promise<void> {
  const res = await fetch("/api/templates/upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      templateId,
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
  const [content, setContent] = useState(template?.content ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<UploadMediaKind | null>(
    (template?.mediaType as UploadMediaKind | null | undefined) ?? null
  );
  const [mediaFileName, setMediaFileName] = useState<string | null>(
    template?.mediaFileName ?? null
  );
  // Preview local (objectURL do arquivo/blob recém-escolhido) tem prioridade
  // sobre a rota de leitura do servidor — evita depender da linha do
  // template já existir no banco (ver createTemplateAction: o id do template
  // é gerado aqui no cliente, então o anexo pode subir pro R2 antes do form
  // ser salvo pela primeira vez).
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Estável durante a vida do diálogo — mesmo id usado na chave do R2 (ver
  // uploadTemplateMedia) e gravado na criação (createTemplateAction agora
  // exige um id vindo do form, ver actions.ts).
  const [templateId] = useState(() => template?.id ?? crypto.randomUUID());
  const action = mode === "create" ? createTemplateAction : updateTemplateAction;

  const exampleValues = useMemo(
    () => Object.fromEntries(variableCatalog.map((v) => [v.key, v.example])),
    [variableCatalog]
  );
  const preview = useMemo(
    () => substituteTemplate(content, exampleValues),
    [content, exampleValues]
  );
  const previewUrl =
    localPreviewUrl ?? (mediaType ? `/api/templates/media/${templateId}` : null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadError(null);
    setIsUploading(true);
    try {
      const contentType = file.type || "application/octet-stream";
      await uploadTemplateMedia(templateId, file, contentType);
      setMediaType(inferMediaKind(contentType));
      setMediaFileName(file.name);
      setLocalPreviewUrl(URL.createObjectURL(file));
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Falha ao anexar arquivo.");
    } finally {
      setIsUploading(false);
    }
  }

  async function handleAudioRecorded(blob: Blob, mimeType: string) {
    setUploadError(null);
    setIsUploading(true);
    try {
      await uploadTemplateMedia(templateId, blob, mimeType);
      setMediaType("audio");
      setMediaFileName(null);
      setLocalPreviewUrl(URL.createObjectURL(blob));
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Falha ao gravar áudio.");
    } finally {
      setIsUploading(false);
    }
  }

  function handleRemoveMedia() {
    setMediaType(null);
    setMediaFileName(null);
    setLocalPreviewUrl(null);
  }

  async function handleSubmit(formData: FormData) {
    setIsPending(true);
    setError(null);
    const result = await action(idleState, formData);
    setIsPending(false);
    if (result.status === "error") {
      setError(result.message);
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger}>{triggerLabel}</DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Novo template" : `Editar ${template?.name}`}
          </DialogTitle>
          <DialogDescription>
            Use variáveis no formato <code>{"{{variavel}}"}</code> — a lista
            de variáveis disponíveis está ao lado. Texto e anexo são
            opcionais, mas pelo menos um dos dois é obrigatório.
          </DialogDescription>
        </DialogHeader>
        <form action={handleSubmit} className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
          <input type="hidden" name="id" value={templateId} />
          <input type="hidden" name="mediaType" value={mediaType ?? ""} />
          <input type="hidden" name="mediaFileName" value={mediaFileName ?? ""} />
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
            <div className="space-y-2">
              <Label htmlFor="content">Conteúdo</Label>
              <textarea
                id="content"
                name="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={8}
                className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20"
              />
              <div className="space-y-1">
                <Label>Preview com dados de exemplo</Label>
                <p className="rounded-lg border border-border bg-muted p-2.5 text-sm whitespace-pre-wrap">
                  {preview || "—"}
                </p>
              </div>

              <div className="space-y-2 border-t border-border pt-3">
                <Label>Anexo</Label>
                {mediaType ? (
                  <div className="space-y-2 rounded-md border border-border p-2.5">
                    <div className="flex items-center gap-2">
                      {mediaType === "audio" ? (
                        <FileAudio size={16} strokeWidth={1.75} className="shrink-0 text-muted-foreground" />
                      ) : (
                        <FileText size={16} strokeWidth={1.75} className="shrink-0 text-muted-foreground" />
                      )}
                      <span className="min-w-0 flex-1 truncate text-sm">
                        {mediaType === "audio" ? "Áudio gravado" : mediaFileName || "Arquivo anexado"}
                      </span>
                      <button
                        type="button"
                        onClick={handleRemoveMedia}
                        aria-label="Remover anexo"
                        className="shrink-0 text-muted-foreground hover:text-foreground"
                      >
                        <X size={14} strokeWidth={1.75} />
                      </button>
                    </div>
                    {previewUrl && mediaType === "audio" && (
                      <audio controls src={previewUrl} className="h-8 w-full" />
                    )}
                    {previewUrl && mediaType === "imagem" && (
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
                    <AudioRecorderButton onRecorded={handleAudioRecorded} disabled={isUploading} />
                    <input ref={fileInputRef} type="file" hidden onChange={handleFileChange} />
                  </div>
                )}
                {uploadError && <p className="text-xs text-destructive">{uploadError}</p>}
              </div>
            </div>
            <div className="space-y-1">
              <Label>Variáveis disponíveis</Label>
              <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
                {variableCatalog.map((v) => (
                  <button
                    key={v.key}
                    type="button"
                    onClick={() => setContent((c) => c + `{{${v.key}}}`)}
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

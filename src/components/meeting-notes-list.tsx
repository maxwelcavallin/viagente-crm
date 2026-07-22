"use client";

import { useState } from "react";
import { Download, ExternalLink, Video } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { downloadTextFile } from "@/lib/utils";

export type MeetingNoteItem = {
  id: string;
  title: string;
  meetingDate: string;
  summary: string;
  actionItems: string[] | null;
  transcript: string | null;
  driveFileUrl: string;
  parsedOk: boolean;
};

function formatMeetingDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function slugFileName(title: string): string {
  return title.replace(/[^a-zA-Z0-9-_]+/g, "-");
}

function meetingNoteToMarkdown(note: MeetingNoteItem): string {
  const lines: string[] = [];
  lines.push(`# ${note.title}`);
  lines.push("");
  lines.push(`**Data:** ${formatMeetingDate(note.meetingDate)}`);
  lines.push("");
  lines.push("## Resumo");
  lines.push("");
  lines.push(note.summary);
  if (note.actionItems && note.actionItems.length > 0) {
    lines.push("");
    lines.push("## Itens de ação");
    lines.push("");
    for (const item of note.actionItems) lines.push(`- ${item}`);
  }
  if (note.transcript) {
    lines.push("");
    lines.push("## Transcrição");
    lines.push("");
    lines.push(note.transcript);
  }
  return lines.join("\n");
}

function MeetingNoteViewDialog({ note }: { note: MeetingNoteItem }) {
  const [open, setOpen] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        Ver mais
      </Button>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{note.title}</DialogTitle>
        </DialogHeader>
        <div className="max-h-[70vh] space-y-3 overflow-y-auto text-sm">
          <p className="text-xs text-muted-foreground">{formatMeetingDate(note.meetingDate)}</p>
          {!note.parsedOk && (
            <Badge variant="warning">Formato não reconhecido automaticamente</Badge>
          )}
          <p className="whitespace-pre-line">{note.summary}</p>
          {note.actionItems && note.actionItems.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground">Itens de ação</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4">
                {note.actionItems.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3">
            {note.transcript && (
              <button
                type="button"
                onClick={() => setShowTranscript((v) => !v)}
                className="text-xs text-primary hover:underline"
              >
                {showTranscript ? "Ocultar transcrição" : "Ver transcrição completa"}
              </button>
            )}
            <a
              href={note.driveFileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <ExternalLink size={11} strokeWidth={1.75} />
              Abrir no Drive
            </a>
          </div>
          {showTranscript && note.transcript && (
            <pre className="max-h-96 overflow-auto rounded-md bg-muted p-2 font-mono text-xs whitespace-pre-wrap">
              {note.transcript}
            </pre>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MeetingNoteRow({ note }: { note: MeetingNoteItem }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3 text-sm">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate font-medium">{note.title}</span>
          {!note.parsedOk && (
            <Badge variant="warning">Formato não reconhecido</Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{formatMeetingDate(note.meetingDate)}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() =>
            downloadTextFile(`resumo-${slugFileName(note.title)}.md`, meetingNoteToMarkdown(note))
          }
        >
          <Download size={13} strokeWidth={1.75} />
          Baixar resumo
        </Button>
        <MeetingNoteViewDialog note={note} />
      </div>
    </li>
  );
}

export function MeetingNotesList({ notes }: { notes: MeetingNoteItem[] }) {
  if (notes.length === 0) {
    return (
      <EmptyState
        icon={Video}
        title="Nenhuma nota de reunião ainda"
        description="Notas do Gemini de reuniões no Meet com convidados reconhecidos aparecem aqui."
      />
    );
  }

  function downloadAll() {
    const content = notes.map(meetingNoteToMarkdown).join("\n\n---\n\n");
    downloadTextFile("resumos-de-reunioes.md", content);
  }

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <Button type="button" variant="outline" size="sm" onClick={downloadAll}>
          <Download size={13} strokeWidth={1.75} />
          Baixar todos os resumos
        </Button>
      </div>
      <ul className="space-y-2">
        {notes.map((note) => (
          <MeetingNoteRow key={note.id} note={note} />
        ))}
      </ul>
    </div>
  );
}

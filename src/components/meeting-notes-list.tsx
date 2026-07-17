"use client";

import { useState } from "react";
import { ExternalLink, Video } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

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

function MeetingNoteRow({ note }: { note: MeetingNoteItem }) {
  const [showTranscript, setShowTranscript] = useState(false);

  return (
    <li className="rounded-lg border border-border p-3 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <span className="font-medium">{note.title}</span>
          <p className="text-xs text-muted-foreground">{formatMeetingDate(note.meetingDate)}</p>
        </div>
        {!note.parsedOk && (
          <Badge variant="warning">Formato não reconhecido automaticamente</Badge>
        )}
      </div>

      <p className="mt-2 whitespace-pre-line text-sm">{note.summary}</p>

      {note.actionItems && note.actionItems.length > 0 && (
        <div className="mt-2">
          <p className="text-xs font-medium text-muted-foreground">Itens de ação</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-sm">
            {note.actionItems.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-3">
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
        <pre className="mt-2 max-h-96 overflow-auto rounded-md bg-muted p-2 font-mono text-xs whitespace-pre-wrap">
          {note.transcript}
        </pre>
      )}
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

  return (
    <ul className="space-y-2">
      {notes.map((note) => (
        <MeetingNoteRow key={note.id} note={note} />
      ))}
    </ul>
  );
}

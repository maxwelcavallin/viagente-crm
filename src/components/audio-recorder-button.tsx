"use client";

import { useRef, useState } from "react";
import { Mic, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function AudioRecorderButton({
  onRecorded,
  disabled,
}: {
  onRecorded: (blob: Blob, mimeType: string) => void;
  disabled?: boolean;
}) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function stopTracks() {
    recorderRef.current?.stream.getTracks().forEach((track) => track.stop());
  }

  async function startRecording() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm; codecs=opus")
        ? "audio/webm; codecs=opus"
        : "audio/webm";
      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
      setSeconds(0);
      intervalRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch {
      setError("Não foi possível acessar o microfone.");
    }
  }

  function cancelRecording() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (recorderRef.current) {
      recorderRef.current.ondataavailable = null;
      recorderRef.current.stop();
      stopTracks();
    }
    chunksRef.current = [];
    setRecording(false);
  }

  function finishRecording() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    const recorder = recorderRef.current;
    if (!recorder) return;

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
      chunksRef.current = [];
      onRecorded(blob, recorder.mimeType);
    };
    recorder.stop();
    stopTracks();
    setRecording(false);
  }

  if (recording) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-status-danger/40 bg-status-danger/10 px-2.5 py-1.5">
        <span className="size-2 shrink-0 animate-pulse rounded-full bg-status-danger" />
        <span className="text-sm tabular-nums text-status-danger">
          {formatDuration(seconds)}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Cancelar gravação"
          onClick={cancelRecording}
        >
          <Trash2 size={16} strokeWidth={1.75} />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Enviar áudio"
          onClick={finishRecording}
        >
          <Send size={16} strokeWidth={1.75} className="text-status-info" />
        </Button>
      </div>
    );
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Gravar áudio"
        disabled={disabled}
        onClick={startRecording}
      >
        <Mic size={18} strokeWidth={1.75} />
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </>
  );
}

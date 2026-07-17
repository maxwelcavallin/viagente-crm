"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { submitNpsResponseAction } from "./actions";

const SCORES = Array.from({ length: 11 }, (_, i) => i);

function scoreColor(score: number): string {
  if (score <= 6) return "border-status-danger text-status-danger data-[selected=true]:bg-status-danger data-[selected=true]:text-white";
  if (score <= 8) return "border-status-warning text-status-warning data-[selected=true]:bg-status-warning data-[selected=true]:text-white";
  return "border-status-success text-status-success data-[selected=true]:bg-status-success data-[selected=true]:text-white";
}

export function NpsForm({ token }: { token: string }) {
  const [score, setScore] = useState<number | null>(null);
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit() {
    if (score === null) {
      setError("Selecione uma nota de 0 a 10.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const result = await submitNpsResponseAction(token, score, feedback);
    setSubmitting(false);

    if (!result.ok) {
      setError(
        result.error === "already_responded"
          ? "Você já respondeu essa pesquisa. Obrigado!"
          : "Não foi possível registrar sua resposta. Tente novamente."
      );
      if (result.error === "already_responded") setDone(true);
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <p className="text-sm text-status-success">
        Obrigado pela sua avaliação! Sua opinião nos ajuda a melhorar.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-6 gap-2 sm:grid-cols-11">
        {SCORES.map((n) => (
          <button
            key={n}
            type="button"
            data-selected={score === n}
            onClick={() => setScore(n)}
            className={cn(
              "flex h-10 w-full items-center justify-center rounded-lg border text-sm font-semibold transition-colors",
              scoreColor(n)
            )}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Pouco provável</span>
        <span>Muito provável</span>
      </div>

      <textarea
        placeholder="Quer contar mais sobre sua experiência? (opcional)"
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        rows={3}
        className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20"
      />

      {error && <p className="text-sm text-status-danger">{error}</p>}

      <Button type="button" onClick={handleSubmit} disabled={submitting} className="w-full">
        {submitting && <Loader2 className="animate-spin" size={16} strokeWidth={1.75} />}
        Enviar avaliação
      </Button>
    </div>
  );
}

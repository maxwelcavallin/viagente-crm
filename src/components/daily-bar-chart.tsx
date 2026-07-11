"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export type DailyBarChartPoint = { date: string; count: number };

function formatDayLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

// Barras finas em HTML/CSS (flex + altura percentual) em vez de SVG — mais
// simples de acertar responsivo/pixel-perfeito que calcular viewBox à mão.
// Série única (volume total de mensagens/dia): sem paleta categórica, cor
// sólida da marca, rótulo do eixo só a cada N barras (nunca uma legenda por
// ponto), tooltip simples no hover — ver skill dataviz.
export function DailyBarChart({ data }: { data: DailyBarChartPoint[] }) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">Sem mensagens nos últimos 90 dias.</p>;
  }

  const max = Math.max(...data.map((d) => d.count), 1);
  const labelEvery = Math.max(1, Math.ceil(data.length / 8));

  return (
    <div className="space-y-1">
      <div className="flex h-40 items-end gap-[2px]">
        {data.map((d, i) => (
          <div
            key={d.date}
            className="group relative flex-1"
            onMouseEnter={() => setHoverIndex(i)}
            onMouseLeave={() => setHoverIndex(null)}
          >
            <div
              className={cn(
                "w-full rounded-t-sm bg-primary/70 transition-colors",
                hoverIndex === i && "bg-primary"
              )}
              style={{ height: `${d.count > 0 ? Math.max((d.count / max) * 100, 3) : 0}%` }}
            />
            {hoverIndex === i && (
              <div className="pointer-events-none absolute -top-8 left-1/2 z-10 -translate-x-1/2 rounded-md border border-border bg-popover px-2 py-1 text-xs whitespace-nowrap text-popover-foreground">
                {formatDayLabel(d.date)} — {d.count}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="flex text-[10px] text-muted-foreground">
        {data.map((d, i) => (
          <div key={d.date} className="flex-1 text-center">
            {i % labelEvery === 0 ? formatDayLabel(d.date) : ""}
          </div>
        ))}
      </div>
    </div>
  );
}

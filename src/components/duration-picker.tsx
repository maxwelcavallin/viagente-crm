"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// "1d 2h 30min" — só as partes não-zero, pra exibir de forma compacta onde
// hoje só mostrava dias (ex: badge "Disparo: +Xd" na lista de tarefas).
export function formatMinutesShort(totalMinutes: number): string {
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}min`);
  return parts.length > 0 ? parts.join(" ") : "0min";
}

// Controlado em minutos totais (o que o banco guarda) — decompõe em
// dias/horas/minutos só pra exibição/edição. 0 minutos é tratado como
// "sem atraso" (mesma coisa que null) por quem consome o valor.
export function DurationPicker({
  idPrefix,
  totalMinutes,
  onChange,
  size = "default",
}: {
  idPrefix: string;
  totalMinutes: number;
  onChange: (totalMinutes: number) => void;
  size?: "default" | "sm";
}) {
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  function update(next: { days?: number; hours?: number; minutes?: number }) {
    const d = next.days ?? days;
    const h = next.hours ?? hours;
    const m = next.minutes ?? minutes;
    onChange(Math.max(0, d) * 1440 + Math.max(0, h) * 60 + Math.max(0, m));
  }

  const inputClassName = size === "sm" ? "h-8 w-14 text-sm" : "w-20";

  return (
    <div className="flex items-end gap-2">
      <div className="space-y-1">
        <Label htmlFor={`${idPrefix}-days`} className="text-xs">
          Dias
        </Label>
        <Input
          id={`${idPrefix}-days`}
          type="number"
          min={0}
          value={days}
          onChange={(e) => update({ days: Number(e.target.value) || 0 })}
          className={inputClassName}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${idPrefix}-hours`} className="text-xs">
          Horas
        </Label>
        <Input
          id={`${idPrefix}-hours`}
          type="number"
          min={0}
          max={23}
          value={hours}
          onChange={(e) => update({ hours: Number(e.target.value) || 0 })}
          className={inputClassName}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${idPrefix}-minutes`} className="text-xs">
          Minutos
        </Label>
        <Input
          id={`${idPrefix}-minutes`}
          type="number"
          min={0}
          max={59}
          value={minutes}
          onChange={(e) => update({ minutes: Number(e.target.value) || 0 })}
          className={inputClassName}
        />
      </div>
    </div>
  );
}

export type Temperature = "quente" | "morno" | "frio";

export const TEMPERATURE_LABELS: Record<Temperature, string> = {
  quente: "Quente",
  morno: "Morno",
  frio: "Frio",
};

export const TEMPERATURE_BADGE_VARIANT: Record<
  Temperature,
  "success" | "warning" | "danger"
> = {
  quente: "success",
  morno: "warning",
  frio: "danger",
};

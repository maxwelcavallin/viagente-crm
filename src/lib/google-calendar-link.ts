// Link de fallback "Adicionar ao Google Agenda" — puro, sem `db`, importado
// também por componentes client (ver ScheduleMeetingDialog) pra quando o
// usuário logado não tem (nem tem acesso a) uma conexão OAuth.
export function buildGoogleCalendarFallbackLink(params: {
  title: string;
  startAt: Date;
  endAt: Date;
  description?: string;
}): string {
  const format = (d: Date) => d.toISOString().replace(/[-:]|\.\d{3}/g, "");
  const search = new URLSearchParams({
    action: "TEMPLATE",
    text: params.title,
    dates: `${format(params.startAt)}/${format(params.endAt)}`,
    ctz: "America/Sao_Paulo",
  });
  if (params.description) search.set("details", params.description);
  return `https://calendar.google.com/calendar/render?${search.toString()}`;
}

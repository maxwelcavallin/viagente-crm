import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { auth } from "@/auth";
import { Button } from "@/components/ui/button";
import { getTrackArticles, trackParamToTrack } from "@/lib/help";
import { HelpMarkdown } from "@/components/help-markdown";

export const dynamic = "force-dynamic";

const TRACK_TITLE = {
  primeiros_passos_admin: "Primeiros passos — Admin",
  primeiros_passos_atendente: "Primeiros passos — Atendente",
} as const;

export default async function HelpTrackPage({
  params,
  searchParams,
}: {
  params: Promise<{ track: string }>;
  searchParams: Promise<{ passo?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { track: trackParam } = await params;
  const track = trackParamToTrack(trackParam);
  if (!track) notFound();

  const articles = await getTrackArticles(track);
  if (articles.length === 0) notFound();

  const { passo } = await searchParams;
  const currentIndex = passo ? articles.findIndex((a) => a.slug === passo) : 0;
  const current = articles[currentIndex === -1 ? 0 : currentIndex];
  const index = currentIndex === -1 ? 0 : currentIndex;
  const previous = index > 0 ? articles[index - 1] : null;
  const next = index < articles.length - 1 ? articles[index + 1] : null;

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <Link
        href="/ajuda"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft size={16} strokeWidth={1.75} />
        Central de Ajuda
      </Link>

      <div className="space-y-1">
        <p className="text-xs font-medium tracking-[0.08em] text-muted-foreground uppercase">
          {TRACK_TITLE[track]} · Passo {index + 1} de {articles.length}
        </p>
        <h1 className="text-2xl font-bold">{current.title}</h1>
      </div>

      <HelpMarkdown content={current.content} />

      <div className="flex items-center justify-between border-t border-border pt-4">
        {previous ? (
          <Button
            variant="outline"
            render={<Link href={`/ajuda/primeiros-passos/${trackParam}?passo=${previous.slug}`} />}
          >
            <ArrowLeft size={16} strokeWidth={1.75} />
            {previous.title}
          </Button>
        ) : (
          <span />
        )}
        {next ? (
          <Button render={<Link href={`/ajuda/primeiros-passos/${trackParam}?passo=${next.slug}`} />}>
            {next.title}
            <ArrowRight size={16} strokeWidth={1.75} />
          </Button>
        ) : (
          <span />
        )}
      </div>
    </div>
  );
}

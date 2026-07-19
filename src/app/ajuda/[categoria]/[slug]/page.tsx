import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/auth";
import { getReferenceArticle } from "@/lib/help";
import { HelpMarkdown } from "@/components/help-markdown";

export const dynamic = "force-dynamic";

export default async function HelpArticlePage({
  params,
}: {
  params: Promise<{ categoria: string; slug: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { categoria, slug } = await params;
  const article = await getReferenceArticle(categoria, slug, session.user.role);
  if (!article) notFound();

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
          {article.categoryName}
        </p>
        <h1 className="text-2xl font-bold">{article.title}</h1>
      </div>
      <HelpMarkdown content={article.content} />
    </div>
  );
}

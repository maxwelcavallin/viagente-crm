import Link from "next/link";
import { redirect } from "next/navigation";
import { GraduationCap, Search, UserCog } from "lucide-react";
import { auth } from "@/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { listHelpCategories, listReferenceArticlesByCategory, searchHelpArticles } from "@/lib/help";
import { HelpCategoryIcon } from "./icon-map";
import { HelpSearchForm } from "./help-search-form";

export const dynamic = "force-dynamic";

export default async function HelpIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = session.user.role;

  const { q } = await searchParams;

  if (q?.trim()) {
    const results = await searchHelpArticles(q, role);
    return (
      <div className="mx-auto max-w-3xl space-y-6 p-6">
        <h1 className="text-2xl font-bold">Central de Ajuda</h1>
        <HelpSearchForm defaultValue={q} />
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">
            {results.length} resultado{results.length === 1 ? "" : "s"} para &quot;{q}&quot;
          </p>
          {results.length === 0 ? (
            <EmptyState icon={Search} title="Nada encontrado" description="Tente outra palavra-chave." />
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {results.map((r) => (
                <li key={r.slug}>
                  <Link
                    href={`/ajuda/${r.categorySlug}/${r.slug}`}
                    className="block p-3 hover:bg-accent"
                  >
                    <p className="font-medium">{r.title}</p>
                    <p className="text-xs text-muted-foreground">{r.categoryName}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    );
  }

  const [categories, articlesByCategory] = await Promise.all([
    listHelpCategories(),
    listReferenceArticlesByCategory(role),
  ]);
  const visibleCategories = categories.filter((c) => (articlesByCategory.get(c.id)?.length ?? 0) > 0);

  return (
    <div className="mx-auto max-w-3xl space-y-8 p-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">Central de Ajuda</h1>
        <p className="text-sm text-muted-foreground">
          Primeiros passos pra quem está começando, e artigos de referência pra qualquer dúvida pontual.
        </p>
      </div>

      <HelpSearchForm />

      <div className="grid gap-3 sm:grid-cols-2">
        <Link href="/ajuda/primeiros-passos/admin">
          <Card className="h-full transition-colors hover:bg-accent">
            <CardContent className="flex items-center gap-3 p-4">
              <UserCog size={22} strokeWidth={1.75} className="shrink-0 text-primary" />
              <div>
                <p className="font-semibold">Primeiros passos — Admin</p>
                <p className="text-xs text-muted-foreground">
                  Configure o CRM do zero, passo a passo
                </p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/ajuda/primeiros-passos/atendente">
          <Card className="h-full transition-colors hover:bg-accent">
            <CardContent className="flex items-center gap-3 p-4">
              <GraduationCap size={22} strokeWidth={1.75} className="shrink-0 text-primary" />
              <div>
                <p className="font-semibold">Primeiros passos — Atendente</p>
                <p className="text-xs text-muted-foreground">
                  Aprenda a usar o dia a dia do CRM
                </p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold tracking-[0.08em] text-muted-foreground uppercase">
          Central de referência
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {visibleCategories.map((category) => {
            const articles = articlesByCategory.get(category.id) ?? [];
            return (
              <Card key={category.id}>
                <CardHeader className="flex flex-row items-center gap-2 space-y-0">
                  <HelpCategoryIcon name={category.icon} className="text-primary" />
                  <CardTitle className="text-sm">{category.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-1.5">
                    {articles.map((article) => (
                      <li key={article.id}>
                        <Link
                          href={`/ajuda/${category.slug}/${article.slug}`}
                          className="text-sm text-primary hover:underline"
                        >
                          {article.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}

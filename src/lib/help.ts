import { and, asc, eq, ilike, or } from "drizzle-orm";
import { db } from "@/db";
import { helpArticles, helpCategories } from "@/db/schema";

export type HelpRole = "admin" | "atendente";

export type HelpCategorySummary = {
  id: string;
  name: string;
  slug: string;
  icon: string;
  order: number;
};

export type HelpArticleSummary = {
  id: string;
  categoryId: string | null;
  title: string;
  slug: string;
  order: number | null;
};

export type HelpArticle = HelpArticleSummary & {
  content: string;
  track: "primeiros_passos_admin" | "primeiros_passos_atendente" | "referencia";
};

// Artigo "todos" sempre aparece; "admin"/"atendente" só aparece pra quem tem
// exatamente aquele papel — mesmo espírito do filtro de item admin-only na
// sidebar (ver sidebar-nav.tsx), só que aplicado à query em vez de um array
// estático.
function roleVisibilityFilter(role: HelpRole) {
  return or(eq(helpArticles.roleVisibility, "todos"), eq(helpArticles.roleVisibility, role));
}

export async function listHelpCategories(): Promise<HelpCategorySummary[]> {
  return db
    .select({
      id: helpCategories.id,
      name: helpCategories.name,
      slug: helpCategories.slug,
      icon: helpCategories.icon,
      order: helpCategories.order,
    })
    .from(helpCategories)
    .orderBy(asc(helpCategories.order));
}

export async function listReferenceArticlesByCategory(
  role: HelpRole
): Promise<Map<string, HelpArticleSummary[]>> {
  const rows = await db
    .select({
      id: helpArticles.id,
      categoryId: helpArticles.categoryId,
      title: helpArticles.title,
      slug: helpArticles.slug,
      order: helpArticles.order,
    })
    .from(helpArticles)
    .where(and(eq(helpArticles.track, "referencia"), roleVisibilityFilter(role)))
    .orderBy(asc(helpArticles.title));

  const byCategory = new Map<string, HelpArticleSummary[]>();
  for (const row of rows) {
    if (!row.categoryId) continue;
    const list = byCategory.get(row.categoryId) ?? [];
    list.push(row);
    byCategory.set(row.categoryId, list);
  }
  return byCategory;
}

export async function getReferenceArticle(
  categorySlug: string,
  articleSlug: string,
  role: HelpRole
): Promise<(HelpArticle & { categorySlug: string; categoryName: string }) | null> {
  const [row] = await db
    .select({
      id: helpArticles.id,
      categoryId: helpArticles.categoryId,
      title: helpArticles.title,
      slug: helpArticles.slug,
      content: helpArticles.content,
      track: helpArticles.track,
      order: helpArticles.order,
      categorySlug: helpCategories.slug,
      categoryName: helpCategories.name,
    })
    .from(helpArticles)
    .innerJoin(helpCategories, eq(helpCategories.id, helpArticles.categoryId))
    .where(
      and(
        eq(helpCategories.slug, categorySlug),
        eq(helpArticles.slug, articleSlug),
        eq(helpArticles.track, "referencia"),
        roleVisibilityFilter(role)
      )
    )
    .limit(1);
  return row ?? null;
}

const TRACK_BY_PARAM = {
  admin: "primeiros_passos_admin",
  atendente: "primeiros_passos_atendente",
} as const;

export function trackParamToTrack(param: string): "primeiros_passos_admin" | "primeiros_passos_atendente" | null {
  return param in TRACK_BY_PARAM ? TRACK_BY_PARAM[param as keyof typeof TRACK_BY_PARAM] : null;
}

export async function getTrackArticles(
  track: "primeiros_passos_admin" | "primeiros_passos_atendente"
): Promise<HelpArticle[]> {
  return db
    .select({
      id: helpArticles.id,
      categoryId: helpArticles.categoryId,
      title: helpArticles.title,
      slug: helpArticles.slug,
      content: helpArticles.content,
      track: helpArticles.track,
      order: helpArticles.order,
    })
    .from(helpArticles)
    .where(eq(helpArticles.track, track))
    .orderBy(asc(helpArticles.order));
}

export type HelpSearchResult = {
  slug: string;
  title: string;
  categorySlug: string;
  categoryName: string;
};

// Busca simples por substring em título/conteúdo (ilike) — cobre o "busca
// por palavra-chave" pedido na etapa, sem precisar de full-text search
// dedicado (tsvector) pro volume de artigos desta central.
export async function searchHelpArticles(
  query: string,
  role: HelpRole
): Promise<HelpSearchResult[]> {
  const term = query.trim();
  if (!term) return [];
  const pattern = `%${term}%`;

  return db
    .select({
      slug: helpArticles.slug,
      title: helpArticles.title,
      categorySlug: helpCategories.slug,
      categoryName: helpCategories.name,
    })
    .from(helpArticles)
    .innerJoin(helpCategories, eq(helpCategories.id, helpArticles.categoryId))
    .where(
      and(
        eq(helpArticles.track, "referencia"),
        roleVisibilityFilter(role),
        or(ilike(helpArticles.title, pattern), ilike(helpArticles.content, pattern))
      )
    )
    .orderBy(asc(helpArticles.title))
    .limit(30);
}

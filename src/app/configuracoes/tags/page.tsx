import { count } from "drizzle-orm";
import { db } from "@/db";
import { contactTags, dealTags, tags } from "@/db/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TagsList, type TagRow } from "./tags-list";
import { CreateTagForm } from "./create-tag-form";

export default async function TagsPage() {
  const [allTags, dealCounts, contactCounts] = await Promise.all([
    db.select().from(tags).orderBy(tags.name),
    db
      .select({ tagId: dealTags.tagId, cnt: count(dealTags.dealId) })
      .from(dealTags)
      .groupBy(dealTags.tagId),
    db
      .select({ tagId: contactTags.tagId, cnt: count(contactTags.contactId) })
      .from(contactTags)
      .groupBy(contactTags.tagId),
  ]);

  const usageByTagId = new Map<string, number>();
  for (const row of dealCounts) {
    usageByTagId.set(row.tagId, (usageByTagId.get(row.tagId) ?? 0) + row.cnt);
  }
  for (const row of contactCounts) {
    usageByTagId.set(row.tagId, (usageByTagId.get(row.tagId) ?? 0) + row.cnt);
  }

  const rows: TagRow[] = allTags.map((tag) => ({
    id: tag.id,
    name: tag.name,
    color: tag.color,
    usageCount: usageByTagId.get(tag.id) ?? 0,
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Tags</h1>
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Tags cadastradas</CardTitle>
          </CardHeader>
          <CardContent>
            <TagsList tags={rows} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Nova tag</CardTitle>
          </CardHeader>
          <CardContent>
            <CreateTagForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

import { asc, sql } from "drizzle-orm";
import { db } from "@/db";
import { contacts, customFieldDefinitions, deals } from "@/db/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldsList, type FieldRowData } from "./fields-list";
import { CreateFieldForm } from "./create-field-form";

async function countUsage(entity: "contact" | "deal", key: string) {
  if (entity === "contact") {
    const [row] = await db
      .select({ cnt: sql<number>`count(*)::int` })
      .from(contacts)
      .where(sql`${contacts.customFields} ? ${key}`);
    return row?.cnt ?? 0;
  }
  const [row] = await db
    .select({ cnt: sql<number>`count(*)::int` })
    .from(deals)
    .where(sql`${deals.customFields} ? ${key}`);
  return row?.cnt ?? 0;
}

export default async function CamposPage() {
  const definitions = await db
    .select()
    .from(customFieldDefinitions)
    .orderBy(asc(customFieldDefinitions.order));

  const withUsage: (FieldRowData & { entity: "contact" | "deal" })[] =
    await Promise.all(
      definitions.map(async (def) => ({
        id: def.id,
        key: def.key,
        label: def.label,
        type: def.type,
        options: (def.options as { value: string; label: string }[] | null) ?? null,
        order: def.order,
        entity: def.entity,
        usageCount: await countUsage(def.entity, def.key),
      }))
    );

  const contactFields = withUsage.filter((f) => f.entity === "contact");
  const dealFields = withUsage.filter((f) => f.entity === "deal");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Campos customizados</h1>
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Campos de contato</CardTitle>
            </CardHeader>
            <CardContent>
              <FieldsList
                key={contactFields.map((f) => f.id).join(",")}
                entity="contact"
                fields={contactFields}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Campos de negócio</CardTitle>
            </CardHeader>
            <CardContent>
              <FieldsList
                key={dealFields.map((f) => f.id).join(",")}
                entity="deal"
                fields={dealFields}
              />
            </CardContent>
          </Card>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Novo campo</CardTitle>
          </CardHeader>
          <CardContent>
            <CreateFieldForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

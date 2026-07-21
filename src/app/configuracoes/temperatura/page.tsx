import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { customFieldDefinitions, temperatureRules } from "@/db/schema";
import { TemperatureRulesList, type TemperatureRuleRow } from "./temperature-rules-list";

export const dynamic = "force-dynamic";

export default async function TemperatureRulesPage() {
  const [ruleRows, dealFieldRows] = await Promise.all([
    db.select().from(temperatureRules).orderBy(asc(temperatureRules.priority)),
    db
      .select({ key: customFieldDefinitions.key, label: customFieldDefinitions.label })
      .from(customFieldDefinitions)
      .where(eq(customFieldDefinitions.entity, "deal"))
      .orderBy(asc(customFieldDefinitions.order)),
  ]);

  const rules: TemperatureRuleRow[] = ruleRows.map((r) => ({
    id: r.id,
    name: r.name,
    conditions: r.conditions as TemperatureRuleRow["conditions"],
    result: r.result,
    priority: r.priority,
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Temperatura de negócios</h1>
      <p className="text-sm text-muted-foreground">
        Define automaticamente a temperatura (quente/morno/frio) de um negócio criado por webhook,
        com base nos campos customizados que chegaram no payload. As regras são avaliadas na ordem
        abaixo — a primeira que bater vence; use uma regra &quot;padrão&quot; por último pra cobrir
        o que sobrar.
      </p>
      <TemperatureRulesList rules={rules} dealFields={dealFieldRows} />
    </div>
  );
}

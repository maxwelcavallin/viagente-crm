import { and, eq } from "drizzle-orm";
import { db } from "../src/db";
import {
  customFieldDefinitions,
  pipelines,
  stages,
  temperatureRules,
} from "../src/db/schema";

const PIPELINE_NAME = "Funil Viagente";

// Ordem exata da seção 12 da spec.
const STAGE_NAMES = [
  "Calculadora",
  "Diagnóstico preenchido",
  "Lead qualificado",
  "Agendamento marcado",
  "Reunião realizada",
  "Proposta enviada",
  "Cliente ativo",
];

// Seção 12 da spec. "mentalidade" é select; a spec descreve os valores como
// "delega / faz sozinho" no rótulo do campo, mas as temperature_rules (seção
// 12) usam o valor 'faz_sozinho' (com underscore) na condição — assumimos
// 'faz_sozinho' como o valor canônico armazenado e "faz sozinho" só como
// rótulo de exibição.
const CUSTOM_FIELDS: {
  key: string;
  label: string;
  type: "texto" | "numero" | "select" | "data";
  options: { value: string; label: string }[] | null;
  order: number;
}[] = [
  {
    key: "gasto_mensal_cartao",
    label: "Gasto mensal no cartão",
    type: "numero",
    options: null,
    order: 0,
  },
  {
    key: "gasto_anual_viagens",
    label: "Gasto anual com viagens",
    type: "numero",
    options: null,
    order: 1,
  },
  {
    key: "frequencia_viagens_ano",
    label: "Frequência de viagens por ano",
    type: "numero",
    options: null,
    order: 2,
  },
  {
    key: "perfil_profissional",
    label: "Perfil profissional",
    type: "texto",
    options: null,
    order: 3,
  },
  {
    key: "mentalidade",
    label: "Mentalidade",
    type: "select",
    options: [
      { value: "delega", label: "Delega" },
      { value: "faz_sozinho", label: "Faz sozinho" },
    ],
    order: 4,
  },
  {
    key: "economia_estimada",
    label: "Economia estimada",
    type: "numero",
    options: null,
    order: 5,
  },
];

// Seção 12 da spec. priority menor = avaliada primeiro.
const TEMPERATURE_RULES: {
  name: string;
  conditions: unknown;
  result: "quente" | "morno" | "frio";
  priority: number;
}[] = [
  {
    name: "Quente",
    conditions: {
      all: [
        { field: "gasto_mensal_cartao", op: ">=", value: 20000 },
        { field: "frequencia_viagens_ano", op: ">=", value: 3 },
        { field: "mentalidade", op: "=", value: "delega" },
      ],
    },
    result: "quente",
    priority: 1,
  },
  {
    name: "Frio",
    conditions: {
      any: [
        { field: "gasto_mensal_cartao", op: "<", value: 10000 },
        { field: "frequencia_viagens_ano", op: "<", value: 1 },
        { field: "mentalidade", op: "=", value: "faz_sozinho" },
      ],
    },
    result: "frio",
    priority: 2,
  },
  {
    name: "Morno",
    conditions: { default: true },
    result: "morno",
    priority: 3,
  },
];

async function seedPipeline() {
  const [pipeline] = await db
    .select()
    .from(pipelines)
    .where(eq(pipelines.name, PIPELINE_NAME))
    .limit(1);

  let pipelineId: string;
  if (pipeline) {
    pipelineId = pipeline.id;
    console.log(`Pipeline "${PIPELINE_NAME}" já existe, reaproveitando.`);
  } else {
    const [created] = await db
      .insert(pipelines)
      .values({ name: PIPELINE_NAME, order: 0 })
      .returning();
    pipelineId = created.id;
    console.log(`Pipeline "${PIPELINE_NAME}" criada.`);
  }

  for (let i = 0; i < STAGE_NAMES.length; i++) {
    const name = STAGE_NAMES[i];
    const [existingStage] = await db
      .select()
      .from(stages)
      .where(and(eq(stages.pipelineId, pipelineId), eq(stages.name, name)))
      .limit(1);

    if (existingStage) {
      console.log(`  Etapa "${name}" já existe, pulando.`);
      continue;
    }

    await db.insert(stages).values({
      pipelineId,
      name,
      order: i,
    });
    console.log(`  Etapa "${name}" criada (order ${i}).`);
  }
}

async function seedCustomFields() {
  for (const field of CUSTOM_FIELDS) {
    const [existing] = await db
      .select()
      .from(customFieldDefinitions)
      .where(
        and(
          eq(customFieldDefinitions.entity, "deal"),
          eq(customFieldDefinitions.key, field.key)
        )
      )
      .limit(1);

    if (existing) {
      console.log(`Campo customizado "${field.key}" já existe, pulando.`);
      continue;
    }

    await db.insert(customFieldDefinitions).values({
      entity: "deal",
      key: field.key,
      label: field.label,
      type: field.type,
      options: field.options,
      order: field.order,
    });
    console.log(`Campo customizado "${field.key}" criado.`);
  }
}

async function seedTemperatureRules() {
  for (const rule of TEMPERATURE_RULES) {
    const [existing] = await db
      .select()
      .from(temperatureRules)
      .where(eq(temperatureRules.name, rule.name))
      .limit(1);

    if (existing) {
      console.log(`Regra de temperatura "${rule.name}" já existe, pulando.`);
      continue;
    }

    await db.insert(temperatureRules).values({
      name: rule.name,
      conditions: rule.conditions,
      result: rule.result,
      priority: rule.priority,
    });
    console.log(`Regra de temperatura "${rule.name}" criada.`);
  }
}

async function main() {
  await seedPipeline();
  await seedCustomFields();
  await seedTemperatureRules();
  console.log("Seed concluído.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Erro no seed:", error);
    process.exit(1);
  });

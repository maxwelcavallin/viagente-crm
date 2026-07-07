import {
  boolean,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// ---------- Enums ----------

export const userRoleEnum = pgEnum("user_role", ["admin", "atendente"]);
export const dealStatusEnum = pgEnum("deal_status", [
  "aberto",
  "ganho",
  "perdido",
]);
export const temperatureEnum = pgEnum("temperature", [
  "quente",
  "morno",
  "frio",
]);
export const stageTaskTypeEnum = pgEnum("stage_task_type", [
  "mensagem",
  "ligacao",
  "agendamento",
  "generica",
]);
export const taskStatusEnum = pgEnum("task_status", ["pendente", "concluida"]);
export const customFieldEntityEnum = pgEnum("custom_field_entity", [
  "deal",
  "contact",
]);
export const customFieldTypeEnum = pgEnum("custom_field_type", [
  "texto",
  "numero",
  "select",
  "data",
]);
export const messageDirectionEnum = pgEnum("message_direction", [
  "entrada",
  "saida",
]);
export const messageTypeEnum = pgEnum("message_type", [
  "texto",
  "imagem",
  "audio",
  "documento",
  "video",
]);
export const messageStatusEnum = pgEnum("message_status", [
  "enviado",
  "entregue",
  "lido",
  "falhou",
]);
export const webhookLogStatusEnum = pgEnum("webhook_log_status", [
  "sucesso",
  "erro",
]);
export const whatsappChannelStatusEnum = pgEnum("whatsapp_channel_status", [
  "conectado",
  "desconectado",
  "pendente",
]);

// ---------- Usuários ----------

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    role: userRoleEnum("role").notNull().default("atendente"),
    passwordHash: text("password_hash").notNull(),
    mustChangePassword: boolean("must_change_password")
      .notNull()
      .default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("users_email_idx").on(t.email)]
);

// ---------- Pipelines e etapas ----------

export const pipelines = pgTable("pipelines", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  order: integer("order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const stages = pgTable(
  "stages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    pipelineId: uuid("pipeline_id")
      .notNull()
      .references(() => pipelines.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    order: integer("order").notNull().default(0),
    color: text("color"),
  },
  (t) => [
    index("stages_pipeline_id_idx").on(t.pipelineId),
    uniqueIndex("stages_pipeline_id_name_idx").on(t.pipelineId, t.name),
  ]
);

// ---------- Templates de mensagem (referenciado por stage_tasks) ----------

export const messageTemplates = pgTable("message_templates", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  content: text("content").notNull(),
  variables: jsonb("variables").notNull().default([]),
});

// ---------- Tarefa padrão por etapa (definição) ----------

export const stageTasks = pgTable(
  "stage_tasks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    stageId: uuid("stage_id")
      .notNull()
      .references(() => stages.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    type: stageTaskTypeEnum("type").notNull(),
    messageTemplateId: uuid("message_template_id").references(
      () => messageTemplates.id,
      { onDelete: "set null" }
    ),
    order: integer("order").notNull().default(0),
  },
  (t) => [index("stage_tasks_stage_id_idx").on(t.stageId)]
);

// ---------- Contatos ----------

export const contacts = pgTable(
  "contacts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    phone: text("phone").notNull(),
    email: text("email"),
    customFields: jsonb("custom_fields").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("contacts_phone_idx").on(t.phone)]
);

// ---------- Negócios ----------

export const deals = pgTable(
  "deals",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id),
    pipelineId: uuid("pipeline_id")
      .notNull()
      .references(() => pipelines.id),
    stageId: uuid("stage_id")
      .notNull()
      .references(() => stages.id),
    ownerId: uuid("owner_id").references(() => users.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    value: numeric("value", { precision: 12, scale: 2 }),
    source: text("source"),
    status: dealStatusEnum("status").notNull().default("aberto"),
    // gasto_mensal_cartao, gasto_anual_viagens, frequencia_viagens_ano,
    // perfil_profissional, mentalidade, economia_estimada — ver seção 12 da spec
    customFields: jsonb("custom_fields").notNull().default({}),
    temperature: temperatureEnum("temperature"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("deals_stage_id_idx").on(t.stageId),
    index("deals_contact_id_idx").on(t.contactId),
  ]
);

// ---------- Tarefas (instâncias) ----------

export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    dealId: uuid("deal_id")
      .notNull()
      .references(() => deals.id, { onDelete: "cascade" }),
    stageTaskId: uuid("stage_task_id").references(() => stageTasks.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    type: stageTaskTypeEnum("type").notNull(),
    status: taskStatusEnum("status").notNull().default("pendente"),
    dueAt: timestamp("due_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    completedBy: uuid("completed_by").references(() => users.id, {
      onDelete: "set null",
    }),
  },
  (t) => [index("tasks_deal_id_idx").on(t.dealId)]
);

// ---------- Tags ----------

export const tags = pgTable(
  "tags",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    color: text("color"),
  },
  (t) => [uniqueIndex("tags_name_idx").on(t.name)]
);

export const dealTags = pgTable(
  "deal_tags",
  {
    dealId: uuid("deal_id")
      .notNull()
      .references(() => deals.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.dealId, t.tagId] })]
);

// Não estava na tabela de referência original (spec só lista deal_tags),
// mas a Etapa 7 pede atribuição de tags a contato — adicionada aqui pelo
// mesmo formato de deal_tags, já que tags são compartilhadas entre as duas
// entidades.
export const contactTags = pgTable(
  "contact_tags",
  {
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.contactId, t.tagId] })]
);

// ---------- Campos customizados (definição dinâmica) ----------

export const customFieldDefinitions = pgTable(
  "custom_field_definitions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    entity: customFieldEntityEnum("entity").notNull(),
    key: text("key").notNull(),
    label: text("label").notNull(),
    type: customFieldTypeEnum("type").notNull(),
    options: jsonb("options"),
    order: integer("order").notNull().default(0),
  },
  (t) => [
    uniqueIndex("custom_field_definitions_entity_key_idx").on(
      t.entity,
      t.key
    ),
  ]
);

// ---------- Canais WhatsApp (Z-API, configurados via UI) ----------
// zapi_token e zapi_client_token são gravados criptografados (AES-256-GCM,
// ver src/lib/credentials-crypto.ts) — nunca em texto puro. zapi_instance_id
// fica em texto puro de propósito: é comparado contra o campo "instanceId"
// do payload do webhook pra validar a origem da chamada (ver seção 7 da spec).

export const whatsappChannels = pgTable("whatsapp_channels", {
  id: uuid("id").defaultRandom().primaryKey(),
  label: text("label").notNull(),
  zapiInstanceId: text("zapi_instance_id").notNull(),
  zapiToken: text("zapi_token").notNull(),
  zapiClientToken: text("zapi_client_token").notNull(),
  phoneNumber: text("phone_number"),
  status: whatsappChannelStatusEnum("status").notNull().default("pendente"),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Controle de acesso por canal — modelo de bloqueio, não de liberação: por
// padrão todo atendente vê todos os canais; uma linha aqui BLOQUEIA o
// usuário daquele canal específico. role='admin' sempre vê tudo, independente
// desta tabela (ver seção 7 da spec).
export const whatsappChannelRestrictions = pgTable(
  "whatsapp_channel_restrictions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    channelId: uuid("channel_id")
      .notNull()
      .references(() => whatsappChannels.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("whatsapp_channel_restrictions_user_channel_idx").on(
      t.userId,
      t.channelId
    ),
  ]
);

// ---------- Mensagens ----------
// Particionada por mês (created_at). drizzle-kit não gera "PARTITION BY"
// nativamente, então a migration gerada é ajustada manualmente para
// transformar esta tabela em partitioned table + criar as partições
// iniciais — ver drizzle/<timestamp>_messages_partitioning.sql e o
// comentário no início desse arquivo. Por isso a PK é composta
// (id, created_at): toda constraint única de uma tabela particionada
// precisa incluir a coluna de particionamento.
export const messages = pgTable(
  "messages",
  {
    id: uuid("id").defaultRandom().notNull(),
    dealId: uuid("deal_id").references(() => deals.id, {
      onDelete: "set null",
    }),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    channelId: uuid("channel_id").references(() => whatsappChannels.id, {
      onDelete: "set null",
    }),
    direction: messageDirectionEnum("direction").notNull(),
    type: messageTypeEnum("type").notNull(),
    content: text("content"),
    mediaUrl: text("media_url"),
    status: messageStatusEnum("status").notNull().default("enviado"),
    zApiMessageId: text("z_api_message_id"),
    isFavorite: boolean("is_favorite").notNull().default(false),
    // Par (id, created_at) em vez de só id: messages é particionada por
    // created_at, então uma FK auto-referenciada só é possível apontando
    // pra chave completa (id, created_at), igual à PK da tabela.
    replyToMessageId: uuid("reply_to_message_id"),
    replyToCreatedAt: timestamp("reply_to_created_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.id, t.createdAt] }),
    index("messages_contact_id_created_at_idx").on(t.contactId, t.createdAt),
    foreignKey({
      columns: [t.replyToMessageId, t.replyToCreatedAt],
      foreignColumns: [t.id, t.createdAt],
    }).onDelete("set null"),
  ]
);

// ---------- Motor de webhook de entrada ----------

export const webhookConfigs = pgTable("webhook_configs", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  sourcePlatform: text("source_platform").notNull(),
  active: boolean("active").notNull().default(true),
  secretToken: text("secret_token").notNull(),
  fieldMapping: jsonb("field_mapping").notNull().default({}),
  // Não listados na tabela de referência da seção 5, mas necessários para o
  // fluxo descrito na seção 6 ("cria negócio na pipeline/etapa padrão
  // configurada pra aquele webhook") — adicionados agora para não exigir
  // nova migration na Etapa 5.
  defaultPipelineId: uuid("default_pipeline_id").references(
    () => pipelines.id,
    { onDelete: "set null" }
  ),
  defaultStageId: uuid("default_stage_id").references(() => stages.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const webhookLogs = pgTable(
  "webhook_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    webhookConfigId: uuid("webhook_config_id")
      .notNull()
      .references(() => webhookConfigs.id, { onDelete: "cascade" }),
    payload: jsonb("payload").notNull(),
    status: webhookLogStatusEnum("status").notNull(),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("webhook_logs_webhook_config_id_idx").on(t.webhookConfigId)]
);

// ---------- Regra de temperatura (configurável) ----------

export const temperatureRules = pgTable("temperature_rules", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  conditions: jsonb("conditions").notNull(),
  result: temperatureEnum("result").notNull(),
  priority: integer("priority").notNull().default(0),
});

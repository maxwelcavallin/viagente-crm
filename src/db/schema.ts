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
// Etapa de automação avançada: quando a task de uma tag_automation é criada.
// "tag_adicionada" dispara na hora (evento síncrono); "dias_apos_tag" é
// varrido pelo cron de automação usando deal_tags.created_at.
export const tagAutomationTriggerEnum = pgEnum("tag_automation_trigger", [
  "tag_adicionada",
  "dias_apos_tag",
]);
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
export const webhookDirectionEnum = pgEnum("webhook_direction", [
  "entrada",
  "saida",
]);
export const whatsappChannelStatusEnum = pgEnum("whatsapp_channel_status", [
  "conectado",
  "desconectado",
  "pendente",
]);
export const scheduledMessageStatusEnum = pgEnum("scheduled_message_status", [
  "pendente",
  "enviada",
  "cancelada",
  "erro",
]);
export const leaddeltaProfileEnum = pgEnum("leaddelta_profile", [
  "Perfil 1",
  "Perfil 2",
  "Sem perfil",
]);
export const sequenceTriggerTypeEnum = pgEnum("sequence_trigger_type", [
  "etapa",
  "tag",
  "sem_resposta",
]);
export const sequenceStepTypeEnum = pgEnum("sequence_step_type", [
  "mensagem",
  "tarefa_generica",
  "tag",
  "mudar_etapa",
]);
export const sequenceRunStatusEnum = pgEnum("sequence_run_status", [
  "em_andamento",
  "concluida",
  "cancelada",
]);
export const notificationTypeEnum = pgEnum("notification_type", [
  "mensagem_nova",
  "tarefa_vencida",
  "tarefa_atribuida",
]);
export const dealActivityActionEnum = pgEnum("deal_activity_action", [
  "criado",
  "editado",
  "etapa_alterada",
  "tag_adicionada",
  "tag_removida",
  "ganho",
  "perdido",
  "excluido",
  "campo_alterado",
]);
export const dealActivitySourceEnum = pgEnum("deal_activity_source", [
  "manual",
  "automacao",
  "webhook",
  // Mutação feita via API pública/MCP (Etapa 28) — distinta de 'webhook'
  // (entrada passiva de terceiros) e 'automacao' (motores internos do
  // próprio CRM): aqui é uma chamada ativa e autenticada por api_key.
  "api",
]);
// 'email' ainda não tem canal implementado (Etapa 26, não feita) — enum já
// preparado pra quando existir, igual a outros enums desta base com valor
// ainda não emitido por nenhum call site (ver notificationTypeEnum).
export const npsChannelEnum = pgEnum("nps_channel", ["whatsapp", "email"]);

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
    // Quando true, este atendente só enxerga negócios/contatos dele mesmo
    // ou sem dono — enforced no servidor (ver src/lib/owner-distribution.ts
    // e os pontos de leitura em negocios/atendimento), não é só filtro de
    // UI. Nunca afeta role='admin'.
    restrictToOwnRecords: boolean("restrict_to_own_records")
      .notNull()
      .default(false),
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

// Lista de motivos de perda configurável pelo admin, por pipeline (cada
// pipeline pode ter categorias de perda diferentes) — ver deals.lossReasonId
// e o painel em configuracoes/pipelines/[id]/loss-reasons-panel.tsx.
export const lossReasons = pgTable("loss_reasons", {
  id: uuid("id").defaultRandom().primaryKey(),
  pipelineId: uuid("pipeline_id")
    .notNull()
    .references(() => pipelines.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  order: integer("order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Regra de distribuição automática de dono por pipeline — usada quando um
// negócio é criado (manual, webhook ou importação) sem dono explícito. Ver
// resolveDistributedOwner em src/lib/owner-distribution.ts: escolhe sempre
// quem está mais "atrasado" em relação a assignedCount/weight (rodízio
// ponderado determinístico, não sorteio).
export const pipelineOwnerDistribution = pgTable(
  "pipeline_owner_distribution",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    pipelineId: uuid("pipeline_id")
      .notNull()
      .references(() => pipelines.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    weight: integer("weight").notNull().default(1),
    assignedCount: integer("assigned_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("pipeline_owner_distribution_pipeline_user_idx").on(t.pipelineId, t.userId)]
);

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
    // Prazo em dias a partir da entrada na etapa — usado pra calcular
    // tasks.due_at quando a tarefa é (auto-)criada. Null = sem prazo.
    daysToComplete: integer("days_to_complete"),
    // Atraso, em minutos, entre o negócio entrar na etapa e a task ser
    // CRIADA (independente de daysToComplete, que é o prazo da task já
    // criada). Null = cria na hora (comportamento original da Etapa 9).
    // Setado = só cria quando o negócio estiver nesta etapa há esse tempo,
    // varrido pelo cron de automação via deals.stage_entered_at. Guarda em
    // minutos (não dias) pra UI permitir configurar dias/horas/minutos.
    triggerDelayMinutes: integer("trigger_delay_minutes"),
    // false = a tarefa fica só como "modelo" disponível pra adicionar
    // manualmente ao negócio (ver addStageTaskToDealAction); não é criada
    // sozinha quando o negócio entra na etapa.
    isAutomatic: boolean("is_automatic").notNull().default(true),
    // Automação sem revisão humana (só faz sentido pra type='mensagem' com
    // messageTemplateId setado): o cron de send-automatic-tasks dispara a
    // mensagem sozinho quando a task vence, sem esperar alguém clicar
    // "Executar". autoSendChannelId é o canal usado nesse disparo.
    autoSend: boolean("auto_send").notNull().default(false),
    autoSendChannelId: uuid("auto_send_channel_id").references(
      () => whatsappChannels.id,
      { onDelete: "set null" }
    ),
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
    // true quando "phone" é na verdade o id de um grupo do WhatsApp
    // (formato Z-API: "<id>-group"), não um número de telefone real.
    isGroup: boolean("is_group").notNull().default(false),
    // Foto do contato ou do grupo (campo "photo"/"senderPhoto" da Z-API).
    avatarUrl: text("avatar_url"),
    // Marca de leitura compartilhada pela equipe (inbox único, não por
    // usuário): zera o contador de não lidas quando qualquer atendente
    // abre a conversa — ver markContactRead em src/lib/conversations.ts.
    lastReadAt: timestamp("last_read_at", { withTimezone: true }),
    customFields: jsonb("custom_fields").notNull().default({}),
    // Dono do atendimento — mantido em sincronia com o dono do negócio
    // aberto deste contato (ver src/lib/owner-distribution.ts). Um contato
    // pode ter mais de um negócio aberto em pipelines diferentes; nesse
    // caso o último negócio reatribuído "vence" aqui, é uma simplificação
    // deliberada.
    ownerId: uuid("owner_id").references(() => users.id, {
      onDelete: "set null",
    }),
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
    // Quando o negócio entrou na etapa atual — resetado toda vez que
    // stage_id muda (ver moveDealStageAction). Base pro gatilho "X dias na
    // etapa" (stageTasks.triggerDelayDays), não confundir com created_at.
    stageEnteredAt: timestamp("stage_entered_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    ownerId: uuid("owner_id").references(() => users.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    value: numeric("value", { precision: 12, scale: 2 }),
    source: text("source"),
    status: dealStatusEnum("status").notNull().default("aberto"),
    // Timestamps de transição de status — diferente de updatedAt (que é
    // tocado por QUALQUER edição do negócio, não só mudança de status).
    // Base pros indicadores de vendas/perdas por período na Início. Null =
    // nunca esteve nesse estado, ou foi reaberto depois (ver
    // setDealStatusAction/setDealLostAction: sempre limpam o par oposto).
    wonAt: timestamp("won_at", { withTimezone: true }),
    lostAt: timestamp("lost_at", { withTimezone: true }),
    lossReasonId: uuid("loss_reason_id").references(() => lossReasons.id, {
      onDelete: "set null",
    }),
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
    // Preenchido quando a task nasce de uma automação de tag (ver
    // tag_automations) — usado pelo cron de automação pra dedupe do
    // gatilho "dias_apos_tag" (não recriar a mesma task a cada varredura).
    tagAutomationId: uuid("tag_automation_id").references(
      () => tagAutomations.id,
      { onDelete: "set null" }
    ),
    // Preenchido quando a task nasce de um passo de automation_sequence
    // (Etapa 22) — mesma função de rastreio de origem que stageTaskId/
    // tagAutomationId têm pros outros dois motores de automação.
    sequenceStepId: uuid("sequence_step_id").references(
      () => automationSequenceSteps.id,
      { onDelete: "set null" }
    ),
    title: text("title").notNull(),
    type: stageTaskTypeEnum("type").notNull(),
    status: taskStatusEnum("status").notNull().default("pendente"),
    dueAt: timestamp("due_at", { withTimezone: true }),
    // Necessário pro dedupe do cron de automação (compara com
    // deals.stage_entered_at / deal_tags.created_at pra saber se a task
    // desta "visita"/"tag" já foi criada). Não existia antes desta etapa.
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    completedBy: uuid("completed_by").references(() => users.id, {
      onDelete: "set null",
    }),
    // Preenchido quando a tarefa tipo "agendamento" cria um evento real no
    // Google Agenda (Etapa 12) — permite editar/cancelar o evento depois,
    // ainda que essa etapa não implemente essa ação ainda.
    googleEventId: text("google_event_id"),
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
    // Quando a tag foi anexada — base pro gatilho "X dias com a tag"
    // (tag_automations.trigger = 'dias_apos_tag').
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.dealId, t.tagId] })]
);

// ---------- Automação por tag (negócio) ----------
//
// Restrita a tags de negócio (deal_tags), não de contato: toda task
// pertence a um deal_id, e um contato pode ter zero ou vários negócios —
// "tag no contato" não tem um negócio único pra receber a task.
export const tagAutomations = pgTable("tag_automations", {
  id: uuid("id").defaultRandom().primaryKey(),
  tagId: uuid("tag_id")
    .notNull()
    .references(() => tags.id, { onDelete: "cascade" }),
  trigger: tagAutomationTriggerEnum("trigger")
    .notNull()
    .default("tag_adicionada"),
  // Só usado quando trigger = 'dias_apos_tag'. Em minutos (não dias) pra UI
  // permitir configurar dias/horas/minutos.
  delayMinutes: integer("delay_minutes"),
  title: text("title").notNull(),
  type: stageTaskTypeEnum("type").notNull(),
  messageTemplateId: uuid("message_template_id").references(
    () => messageTemplates.id,
    { onDelete: "set null" }
  ),
  autoSend: boolean("auto_send").notNull().default(false),
  autoSendChannelId: uuid("auto_send_channel_id").references(
    () => whatsappChannels.id,
    { onDelete: "set null" }
  ),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

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
  // Repasse (fan-out) do payload cru recebido da Z-API pra outro sistema que
  // também usa essa mesma instância — a Z-API só aceita uma URL cadastrada
  // por evento, então quem precisa de mais de um consumidor tem que
  // replicar por conta própria (ver /api/whatsapp/webhook/[channelId]).
  // Null = não repassa. Cobre tanto "ao receber" quanto "status".
  relayWebhookUrl: text("relay_webhook_url"),
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
    // Preenchidos só quando a mensagem vem de um grupo (isGroup=true no
    // payload da Z-API): identifica qual participante enviou, já que
    // contactId aponta pro grupo inteiro, não pra pessoa.
    senderName: text("sender_name"),
    senderPhone: text("sender_phone"),
    senderAvatarUrl: text("sender_avatar_url"),
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

// ---------- Importação de CSV (Etapa 11) ----------
// Um registro por arquivo importado — resumo pra auditoria, não linha a
// linha (os erros de linha individuais ficam no jsonb "errors").
export const csvImports = pgTable("csv_imports", {
  id: uuid("id").defaultRandom().primaryKey(),
  fileName: text("file_name").notNull(),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  pipelineId: uuid("pipeline_id").references(() => pipelines.id, { onDelete: "set null" }),
  contactsCreated: integer("contacts_created").notNull().default(0),
  contactsUpdated: integer("contacts_updated").notNull().default(0),
  dealsCreated: integer("deals_created").notNull().default(0),
  errorCount: integer("error_count").notNull().default(0),
  errors: jsonb("errors").notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ---------- Mensagens agendadas ----------
// Disparadas pelo cron /api/cron/send-scheduled-messages (ver vercel.json).
// Ao enviar com sucesso, cria a linha correspondente em "messages" — igual
// ao fluxo de envio imediato de /api/messages/send.
export const scheduledMessages = pgTable(
  "scheduled_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    dealId: uuid("deal_id").references(() => deals.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    channelId: uuid("channel_id")
      .notNull()
      .references(() => whatsappChannels.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
    status: scheduledMessageStatusEnum("status").notNull().default("pendente"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    errorMessage: text("error_message"),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("scheduled_messages_contact_id_idx").on(t.contactId),
    index("scheduled_messages_status_scheduled_at_idx").on(
      t.status,
      t.scheduledAt
    ),
  ]
);

// ---------- Motor de webhook (entrada e saída) ----------

export const webhookConfigs = pgTable("webhook_configs", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  direction: webhookDirectionEnum("direction").notNull().default("entrada"),
  // Entrada: nome da plataforma de origem (ex: "Calculadora") + token de
  // autenticação da URL única. Nulos quando direction='saida'.
  sourcePlatform: text("source_platform"),
  active: boolean("active").notNull().default(true),
  secretToken: text("secret_token"),
  fieldMapping: jsonb("field_mapping").notNull().default({}),
  // Tags estáticas (Etapa 13): aplicadas a TODO contato/negócio criado por
  // este webhook, pra identificar a origem — não vêm do payload (ver
  // decisão em webhook-inbound.ts). Array de tags.id em texto puro.
  contactTagIds: jsonb("contact_tag_ids").notNull().default([]),
  dealTagIds: jsonb("deal_tag_ids").notNull().default([]),
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
  // Saída: URL de destino + eventos que disparam o POST. Nulos quando
  // direction='entrada'.
  targetUrl: text("target_url"),
  events: jsonb("events"),
  // Escopo opcional do webhook de saída (Etapa 10): sem pipelineId, dispara
  // pra qualquer pipeline; com pipelineId mas sem stageId, dispara pra
  // qualquer etapa dentro daquela pipeline; com os dois, só dispara quando o
  // negócio entra exatamente naquela etapa (só relevante junto do evento
  // 'etapa_alterada' — os demais eventos ignoram stageId).
  pipelineId: uuid("pipeline_id").references(() => pipelines.id, {
    onDelete: "cascade",
  }),
  stageId: uuid("stage_id").references(() => stages.id, {
    onDelete: "cascade",
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
    direction: webhookDirectionEnum("direction").notNull().default("entrada"),
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

// ---------- Google Agenda (Etapa 12) ----------
// Uma conexão por usuário (o dono da conta Google que autorizou o OAuth).
// Tokens criptografados em repouso com a mesma chave da Etapa 5
// (CREDENTIALS_ENCRYPTION_KEY) — ver src/lib/credentials-crypto.ts.
export const googleCalendarConnections = pgTable(
  "google_calendar_connections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    refreshToken: text("refresh_token").notNull(),
    accessToken: text("access_token"),
    tokenExpiry: timestamp("token_expiry", { withTimezone: true }),
    calendarId: text("calendar_id").notNull().default("primary"),
    connectedAt: timestamp("connected_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("google_calendar_connections_user_id_idx").on(t.userId)]
);

// Compartilhamento: um admin libera o uso da própria conexão (linha acima)
// pra atendentes específicos agendarem em nome dela, sem cada um precisar
// conectar a própria conta. "ownerUserId" é quem conectou (dono da agenda);
// "sharedWithUserId" é quem ganhou permissão de usar.
export const googleCalendarShares = pgTable(
  "google_calendar_shares",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sharedWithUserId: uuid("shared_with_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("google_calendar_shares_owner_shared_idx").on(
      t.ownerUserId,
      t.sharedWithUserId
    ),
  ]
);

// ---------- LinkedIn via LeadDelta (Etapa 20) ----------
// Configuração única (1 registro só, igual a whatsapp_channels mas sem
// suportar múltiplos). API key criptografada em repouso com a mesma chave
// das demais integrações (ver src/lib/credentials-crypto.ts).
export const leaddeltaSettings = pgTable("leaddelta_settings", {
  id: uuid("id").defaultRandom().primaryKey(),
  apiKey: text("api_key").notNull(),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Snapshot sincronizado das conexões da LeadDelta — nunca consultado ao vivo
// (ver decisão de arquitetura da Etapa 20). funnelStage/profile/
// locationNormalized são recalculados a cada sync a partir de tags/location
// brutas, pela lógica portada em src/lib/leaddelta-analytics.ts.
export const leaddeltaConnections = pgTable(
  "leaddelta_connections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    leaddeltaId: text("leaddelta_id").notNull(),
    firstName: text("first_name").notNull().default(""),
    lastName: text("last_name").notNull().default(""),
    headline: text("headline").notNull().default(""),
    company: text("company").notNull().default(""),
    jobTitle: text("job_title").notNull().default(""),
    location: text("location").notNull().default(""),
    locationNormalized: text("location_normalized").notNull().default(""),
    email: text("email").notNull().default(""),
    linkedinUrl: text("linkedin_url").notNull().default(""),
    workspaceName: text("workspace_name").notNull().default(""),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    funnelStage: text("funnel_stage").notNull().default("Sem estágio"),
    profile: leaddeltaProfileEnum("profile").notNull().default("Sem perfil"),
    hasEmail: boolean("has_email").notNull().default(false),
    hasNotes: boolean("has_notes").notNull().default(false),
    hasPhone: boolean("has_phone").notNull().default(false),
    connectedAt: timestamp("connected_at", { withTimezone: true }),
    syncedAt: timestamp("synced_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("leaddelta_connections_leaddelta_id_idx").on(t.leaddeltaId),
  ]
);

export const leaddeltaSyncLog = pgTable("leaddelta_sync_log", {
  id: uuid("id").defaultRandom().primaryKey(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  connectionsCount: integer("connections_count").notNull().default(0),
  status: webhookLogStatusEnum("status").notNull(),
  errorMessage: text("error_message"),
});

// ---------- Automações inteligentes (Etapa 22) ----------
// Expande a Etapa 13 (stage_tasks/tag_automations, gatilho único + atraso)
// com sequências de múltiplos passos, condição opcional sobre o negócio, e
// um terceiro gatilho ("sem_resposta") que não existe nos outros dois
// motores. Reaproveita o mesmo cron horário da Etapa 13 pra avançar passos
// vencidos e detectar o gatilho de falta de resposta (ver runSequenceSweep
// em src/lib/automation-sequences.ts).
export const automationSequences = pgTable("automation_sequences", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  active: boolean("active").notNull().default(true),
  triggerType: sequenceTriggerTypeEnum("trigger_type").notNull(),
  triggerStageId: uuid("trigger_stage_id").references(() => stages.id, {
    onDelete: "cascade",
  }),
  triggerTagId: uuid("trigger_tag_id").references(() => tags.id, {
    onDelete: "cascade",
  }),
  // Só usado quando triggerType='sem_resposta'. Em dias (não minutos) —
  // diferente do delay entre passos, esse número tende a ser falado em dias
  // corridos pelo usuário ("5 dias sem resposta"), sem necessidade de
  // granularidade menor.
  noResponseDays: integer("no_response_days"),
  // Condição simples opcional sobre o negócio no momento do gatilho —
  // { field: 'temperature'|'tags'|<custom_field_key>, operator: 'eq'|'gt'|'lt'|'contains', value: string }.
  // Null = sem condição, sequência sempre inicia quando o gatilho bate.
  conditions: jsonb("conditions").$type<{
    field: string;
    operator: "eq" | "gt" | "lt" | "contains";
    value: string;
  } | null>(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const automationSequenceSteps = pgTable(
  "automation_sequence_steps",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sequenceId: uuid("sequence_id")
      .notNull()
      .references(() => automationSequences.id, { onDelete: "cascade" }),
    order: integer("order").notNull().default(0),
    // Desde o passo anterior — ou desde o disparo do gatilho, se for o
    // primeiro passo da sequência (order=0).
    delayMinutes: integer("delay_minutes").notNull().default(0),
    type: sequenceStepTypeEnum("type").notNull(),
    // Título da tarefa criada — usado por 'tarefa_generica' e por 'mensagem'
    // quando autoSend=false (a task fica pendente pra alguém completar/
    // enviar manualmente, igual ao padrão de stage_tasks/tag_automations).
    // Não está no esboço de migration da etapa, mas é indispensável: sem
    // título não dá pra criar a linha em `tasks`.
    title: text("title"),
    messageTemplateId: uuid("message_template_id").references(
      () => messageTemplates.id,
      { onDelete: "set null" }
    ),
    autoSend: boolean("auto_send").notNull().default(false),
    autoSendChannelId: uuid("auto_send_channel_id").references(
      () => whatsappChannels.id,
      { onDelete: "set null" }
    ),
    addTagId: uuid("add_tag_id").references(() => tags.id, {
      onDelete: "cascade",
    }),
    moveToStageId: uuid("move_to_stage_id").references(() => stages.id, {
      onDelete: "cascade",
    }),
  },
  (t) => [index("automation_sequence_steps_sequence_id_idx").on(t.sequenceId)]
);

export const automationSequenceRuns = pgTable(
  "automation_sequence_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sequenceId: uuid("sequence_id")
      .notNull()
      .references(() => automationSequences.id, { onDelete: "cascade" }),
    dealId: uuid("deal_id")
      .notNull()
      .references(() => deals.id, { onDelete: "cascade" }),
    currentStepOrder: integer("current_step_order").notNull().default(0),
    status: sequenceRunStatusEnum("status").notNull().default("em_andamento"),
    startedAt: timestamp("started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    nextStepAt: timestamp("next_step_at", { withTimezone: true }),
  },
  (t) => [
    index("automation_sequence_runs_deal_id_idx").on(t.dealId),
    index("automation_sequence_runs_sequence_id_idx").on(t.sequenceId),
  ]
);

// ---------- Notificações (Etapa 23) ----------
// messageId é só informativo (sem FK): messages é particionada por
// created_at, a PK real é o par (id, created_at) — replicar essa FK composta
// aqui só pra rastreio não compensa a complexidade, quem precisa navegar até
// a conversa usa contactId.
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: notificationTypeEnum("type").notNull(),
    dealId: uuid("deal_id").references(() => deals.id, { onDelete: "cascade" }),
    taskId: uuid("task_id").references(() => tasks.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id").references(() => contacts.id, { onDelete: "cascade" }),
    messageId: uuid("message_id"),
    title: text("title").notNull(),
    body: text("body").notNull(),
    read: boolean("read").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("notifications_user_id_created_at_idx").on(t.userId, t.createdAt),
    index("notifications_user_id_read_idx").on(t.userId, t.read),
  ]
);

// ---------- Auditoria de negócios (Etapa 24) ----------
// dealId sem FK, de propósito: ao contrário das demais tabelas filhas de
// deals (que cascade e somem junto com o negócio), o registro 'excluido'
// só cumpre sua função de auditoria se sobreviver à própria exclusão do
// negócio que ele documenta — deals não tem soft-delete.
export const dealActivityLog = pgTable(
  "deal_activity_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    dealId: uuid("deal_id").notNull(),
    // Nullable: alterações vindas de webhook/automação não têm um usuário
    // humano por trás (ver dealActivitySourceEnum).
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    action: dealActivityActionEnum("action").notNull(),
    fieldName: text("field_name"),
    oldValue: text("old_value"),
    newValue: text("new_value"),
    source: dealActivitySourceEnum("source").notNull().default("manual"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("deal_activity_log_deal_id_created_at_idx").on(t.dealId, t.createdAt)]
);

// ---------- Pós-venda / NPS (Etapa 27) ----------
// Config única (1 registro só, igual a leaddelta_settings) — não está no
// esboço de migration da etapa, mas é indispensável: "atraso configurável"
// e "reaproveitar o composer/canal já configurado" exigem algum lugar pra
// guardar qual etapa/canal/template usar, e não existe um motor de
// automação pronto pro gatilho "negócio ganho" (automation_sequences só
// cobre etapa/tag/sem_resposta, ver sequenceTriggerTypeEnum).
export const npsSettings = pgTable("nps_settings", {
  id: uuid("id").defaultRandom().primaryKey(),
  active: boolean("active").notNull().default(false),
  // Etapa "Cliente ativo" (ou equivalente) — null = não dispara por etapa.
  triggerStageId: uuid("trigger_stage_id").references(() => stages.id, {
    onDelete: "set null",
  }),
  triggerOnWon: boolean("trigger_on_won").notNull().default(true),
  // Em dias — mesmo raciocínio de stageTasks.daysToComplete, mas contado a
  // partir de stageEnteredAt (gatilho por etapa) ou wonAt (gatilho por
  // ganho), o que disparou.
  delayDays: integer("delay_days").notNull().default(3),
  channelId: uuid("channel_id").references(() => whatsappChannels.id, {
    onDelete: "set null",
  }),
  // Conteúdo deve incluir {{link_pesquisa}} — substituído no envio (ver
  // src/lib/nps.ts). Mesma engine de variáveis dos demais templates
  // (substituteTemplate), variável a mais só usada aqui.
  messageTemplateId: uuid("message_template_id").references(
    () => messageTemplates.id,
    { onDelete: "set null" }
  ),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const npsSurveys = pgTable(
  "nps_surveys",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    dealId: uuid("deal_id")
      .notNull()
      .references(() => deals.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
    channel: npsChannelEnum("channel").notNull(),
    token: text("token").notNull(),
    score: integer("score"),
    feedback: text("feedback"),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("nps_surveys_token_idx").on(t.token),
    // Um envio por negócio, no máximo (ver "fora de escopo" da Etapa 27) —
    // a varredura do cron consulta por dealId pra decidir se já disparou.
    uniqueIndex("nps_surveys_deal_id_idx").on(t.dealId),
  ]
);

// ---------- API pública / MCP (Etapa 28) ----------
// keyHash guarda sha256(chave) em hex, nunca a chave em si — mesma lógica
// de um token de acesso pessoal (GitHub/Stripe): a chave só existe em texto
// puro no momento da criação (mostrada uma única vez pro admin), e a busca
// por hash é uma igualdade indexada direta, sem precisar de bcrypt (a chave
// já nasce com entropia alta, ao contrário de senha escolhida por humano).
// scopes é array pra deixar aberto a granularidade futura, mas por ora só
// dois valores emitidos: ["leitura"] ou ["leitura","escrita"] (ver
// requireWriteScope em src/lib/api-keys.ts).
// rateLimitWindowStart/rateLimitCount não estão no esboço de migration da
// etapa, mas são o jeito mais simples de fazer "rate limiting básico por
// chave" sem depender de um serviço externo (Redis) que este projeto não
// tem — janela fixa de 1 minuto, reiniciada quando expira.
export const apiKeys = pgTable("api_keys", {
  id: uuid("id").defaultRandom().primaryKey(),
  label: text("label").notNull(),
  keyHash: text("key_hash").notNull(),
  scopes: jsonb("scopes").$type<string[]>().notNull().default(["leitura"]),
  createdByUserId: uuid("created_by_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  active: boolean("active").notNull().default(true),
  rateLimitWindowStart: timestamp("rate_limit_window_start", { withTimezone: true }),
  rateLimitCount: integer("rate_limit_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (t) => [uniqueIndex("api_keys_key_hash_idx").on(t.keyHash)]);

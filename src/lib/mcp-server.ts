import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  addTagToDealForApiKey,
  completeTaskForApiKey,
  createContactForApiKey,
  createDealForApiKey,
  createTaskForApiKey,
  getContact,
  getDeal,
  getDealConversation,
  listContacts,
  listDeals,
  listTasks,
  moveDealStageForApiKey,
  removeTagFromDealForApiKey,
  sendActivityEmailForApiKey,
  sendMessageForApiKey,
  updateContactForApiKey,
  updateDealForApiKey,
} from "@/lib/api-v1";
import {
  createAutomationSequenceForApiKey,
  createCustomFieldForApiKey,
  createEmailTemplateForApiKey,
  createMessageTemplateForApiKey,
  createPipelineForApiKey,
  createStageForApiKey,
  createStageTaskForApiKey,
  createTagAutomationForApiKey,
  createTagForApiKey,
  createWebhookForApiKey,
  deleteAutomationSequenceForApiKey,
  deleteCustomFieldForApiKey,
  deleteEmailTemplateForApiKey,
  deleteMessageTemplateForApiKey,
  deletePipelineForApiKey,
  deleteStageForApiKey,
  deleteStageTaskForApiKey,
  deleteTagAutomationForApiKey,
  deleteTagForApiKey,
  deleteWebhookForApiKey,
  getAutomationSequenceForApiKey,
  listAutomationSequencesForApiKey,
  listChannelsForApiKey,
  listCustomFieldsForApiKey,
  listEmailTemplatesForApiKey,
  listLossReasonsForApiKey,
  listMessageTemplatesForApiKey,
  listPipelinesForApiKey,
  listStagesForApiKey,
  listStageTasksForApiKey,
  listTagAutomationsForApiKey,
  listTagsForApiKey,
  listWebhooksForApiKey,
  updateAutomationSequenceForApiKey,
  updateCustomFieldForApiKey,
  updateEmailTemplateForApiKey,
  updateMessageTemplateForApiKey,
  updatePipelineForApiKey,
  updateStageForApiKey,
  updateStageTaskForApiKey,
  updateTagAutomationForApiKey,
  updateTagForApiKey,
  updateWebhookForApiKey,
} from "@/lib/api-v1-admin";
import { hasAdminScope, type AuthenticatedApiKey } from "@/lib/api-keys";
import {
  getReferenceArticle,
  listHelpCategories,
  listReferenceArticlesByCategory,
  searchHelpArticles,
} from "@/lib/help";

function textResult(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

function errorResult(message: string) {
  return { content: [{ type: "text" as const, text: `Erro: ${message}` }], isError: true };
}

const sequenceStepSchema = z.object({
  delayMinutes: z.number().int().min(0),
  type: z.enum(["mensagem", "tarefa_generica", "tag", "mudar_etapa"]),
  title: z.string().optional().nullable(),
  messageTemplateId: z.string().uuid().optional().nullable(),
  autoSend: z.boolean().optional(),
  autoSendChannelId: z.string().uuid().optional().nullable(),
  addTagId: z.string().uuid().optional().nullable(),
  moveToStageId: z.string().uuid().optional().nullable(),
});

// Um McpServer novo por request HTTP (modo stateless — ver src/app/api/mcp/
// route.ts): os tools fecham sobre a api_key já autenticada desta chamada,
// então cada tool reaproveita exatamente as mesmas funções de negócio da
// API REST (src/lib/api-v1.ts e src/lib/api-v1-admin.ts) — mesmo filtro/
// permissão/escopo dos dois lados, um só lugar pra manter (ver critério de
// aceite da Etapa 28). Tools "operacionais" (Part A) são registradas pra
// qualquer chave válida; tools "admin" (Part B, configuração do CRM) só são
// registradas quando a chave tem hasAdminScope — um cliente MCP com chave
// operacional nem enxerga essas ferramentas na lista.
export function createMcpServer(apiKey: AuthenticatedApiKey): McpServer {
  const server = new McpServer({ name: "viagente-crm", version: "2.0.0" });

  // ---------- Negócios ----------

  server.registerTool(
    "listar_negocios",
    {
      title: "Listar negócios",
      description:
        "Consulta negócios do CRM por etapa, pipeline, dono, status, temperatura, tag ou busca textual.",
      inputSchema: {
        pipelineId: z.string().uuid().optional(),
        stageId: z.string().uuid().optional(),
        ownerId: z.string().optional().describe("uuid de um usuário, \"me\" ou \"unassigned\""),
        status: z.enum(["aberto", "ganho", "perdido"]).optional(),
        temperature: z.enum(["quente", "morno", "frio"]).optional(),
        tagId: z.string().uuid().optional(),
        search: z.string().optional().describe("busca por título do negócio ou nome do contato"),
        limit: z.number().int().min(1).max(200).optional(),
      },
    },
    async (args) => textResult({ deals: await listDeals(apiKey.actingUser, args) })
  );

  server.registerTool(
    "detalhar_negocio",
    {
      title: "Detalhar negócio",
      description: "Busca os dados completos de um negócio específico pelo id.",
      inputSchema: { dealId: z.string().uuid() },
    },
    async ({ dealId }) => {
      const deal = await getDeal(apiKey.actingUser, dealId);
      if (!deal) return errorResult("Negócio não encontrado.");
      return textResult({ deal });
    }
  );

  server.registerTool(
    "historico_conversa_negocio",
    {
      title: "Histórico de conversa do negócio",
      description: "Retorna o histórico de mensagens trocadas com o contato de um negócio.",
      inputSchema: { dealId: z.string().uuid() },
    },
    async ({ dealId }) => {
      const result = await getDealConversation(apiKey.actingUser, dealId);
      if (!result.ok) return errorResult(result.error);
      return textResult({ messages: result.data });
    }
  );

  server.registerTool(
    "criar_negocio",
    {
      title: "Criar negócio",
      description: "Cria um novo negócio numa pipeline/etapa, associado a um contato existente.",
      inputSchema: {
        contactId: z.string().uuid(),
        pipelineId: z.string().uuid(),
        stageId: z.string().uuid(),
        title: z.string().optional().describe("se omitido, usa o nome do contato"),
        ownerId: z.string().uuid().optional().nullable(),
        value: z.string().optional().nullable(),
        customFields: z.record(z.string(), z.unknown()).optional(),
        tagIds: z.array(z.string().uuid()).optional(),
      },
    },
    async (args) => {
      const result = await createDealForApiKey(apiKey, args);
      if (!result.ok) return errorResult(result.error);
      return textResult(result.data);
    }
  );

  server.registerTool(
    "editar_negocio",
    {
      title: "Editar negócio",
      description:
        "Edita campos de um negócio existente (título, dono, valor, etapa, campos customizados, status). " +
        "Pra marcar como perdido, status=\"perdido\" exige lossReasonId (ver listar_motivos_perda, chave admin). " +
        "Marcar como ganho ou reabrir (status=\"aberto\") não precisa de lossReasonId.",
      inputSchema: {
        dealId: z.string().uuid(),
        title: z.string().optional(),
        ownerId: z.string().uuid().optional().nullable(),
        value: z.string().optional().nullable(),
        stageId: z.string().uuid().optional(),
        customFields: z.record(z.string(), z.unknown()).optional(),
        status: z.enum(["aberto", "ganho", "perdido"]).optional(),
        lossReasonId: z.string().uuid().optional(),
      },
    },
    async ({ dealId, ...params }) => {
      const result = await updateDealForApiKey(apiKey, dealId, params);
      if (!result.ok) return errorResult(result.error);
      return textResult(result.data);
    }
  );

  server.registerTool(
    "mover_negocio_etapa",
    {
      title: "Mover negócio de etapa",
      description: "Move um negócio pra outra etapa do pipeline.",
      inputSchema: { dealId: z.string().uuid(), stageId: z.string().uuid() },
    },
    async ({ dealId, stageId }) => {
      const result = await moveDealStageForApiKey(apiKey, dealId, stageId);
      if (!result.ok) return errorResult(result.error);
      return textResult(result.data);
    }
  );

  server.registerTool(
    "adicionar_tag_negocio",
    {
      title: "Adicionar tag ao negócio",
      description: "Anexa uma tag existente a um negócio.",
      inputSchema: { dealId: z.string().uuid(), tagId: z.string().uuid() },
    },
    async ({ dealId, tagId }) => {
      const result = await addTagToDealForApiKey(apiKey, dealId, tagId);
      if (!result.ok) return errorResult(result.error);
      return textResult(result.data);
    }
  );

  server.registerTool(
    "remover_tag_negocio",
    {
      title: "Remover tag do negócio",
      description: "Remove uma tag de um negócio.",
      inputSchema: { dealId: z.string().uuid(), tagId: z.string().uuid() },
    },
    async ({ dealId, tagId }) => {
      const result = await removeTagFromDealForApiKey(apiKey, dealId, tagId);
      if (!result.ok) return errorResult(result.error);
      return textResult(result.data);
    }
  );

  server.registerTool(
    "enviar_email_negocio",
    {
      title: "Enviar email de atividade",
      description: "Envia um email avulso pro contato de um negócio (Etapa 26), registrado no histórico do negócio.",
      inputSchema: {
        dealId: z.string().uuid(),
        to: z.string().email(),
        subject: z.string().min(1),
        body: z.string().min(1),
      },
    },
    async ({ dealId, to, subject, body }) => {
      const result = await sendActivityEmailForApiKey(apiKey, { dealId, to, subject, body });
      if (!result.ok) return errorResult(result.error);
      return textResult(result.data);
    }
  );

  // ---------- Contatos ----------

  server.registerTool(
    "listar_contatos",
    {
      title: "Listar contatos",
      description: "Consulta contatos por nome/telefone (busca textual) ou dono.",
      inputSchema: {
        search: z.string().optional(),
        ownerId: z.string().optional(),
        limit: z.number().int().min(1).max(200).optional(),
      },
    },
    async (args) => textResult({ contacts: await listContacts(apiKey.actingUser, args) })
  );

  server.registerTool(
    "detalhar_contato",
    {
      title: "Detalhar contato",
      description: "Busca os dados completos de um contato pelo id.",
      inputSchema: { contactId: z.string().uuid() },
    },
    async ({ contactId }) => {
      const contact = await getContact(apiKey.actingUser, contactId);
      if (!contact) return errorResult("Contato não encontrado.");
      return textResult({ contact });
    }
  );

  server.registerTool(
    "criar_contato",
    {
      title: "Criar contato",
      description:
        "Cria um novo contato — informe phone e/ou email (pelo menos um dos dois; " +
        "cada um precisa ser único no CRM quando informado).",
      inputSchema: {
        name: z.string().min(1),
        phone: z.string().optional().nullable(),
        email: z.string().email().optional().nullable(),
        customFields: z.record(z.string(), z.unknown()).optional(),
      },
    },
    async (args) => {
      const result = await createContactForApiKey(apiKey, args);
      if (!result.ok) return errorResult(result.error);
      return textResult(result.data);
    }
  );

  server.registerTool(
    "editar_contato",
    {
      title: "Editar contato",
      description:
        "Edita campos de um contato existente — não é possível deixar phone e email " +
        "vazios ao mesmo tempo.",
      inputSchema: {
        contactId: z.string().uuid(),
        name: z.string().optional(),
        phone: z.string().optional().nullable(),
        email: z.string().email().optional().nullable(),
        customFields: z.record(z.string(), z.unknown()).optional(),
      },
    },
    async ({ contactId, ...params }) => {
      const result = await updateContactForApiKey(apiKey, contactId, params);
      if (!result.ok) return errorResult(result.error);
      return textResult(result.data);
    }
  );

  // ---------- Mensagens / tarefas ----------

  server.registerTool(
    "enviar_mensagem_whatsapp",
    {
      title: "Enviar mensagem",
      description: "Envia uma mensagem de texto via WhatsApp pro contato informado.",
      inputSchema: {
        channelId: z.string().uuid(),
        contactId: z.string().uuid(),
        message: z.string().min(1),
      },
    },
    async (args) => {
      const result = await sendMessageForApiKey(apiKey, args);
      if (!result.ok) return errorResult(result.error);
      return textResult(result.data);
    }
  );

  server.registerTool(
    "listar_tarefas",
    {
      title: "Listar tarefas",
      description: "Lista tarefas, opcionalmente filtradas por negócio e status.",
      inputSchema: {
        dealId: z.string().uuid().optional(),
        status: z.enum(["pendente", "concluida"]).optional(),
        limit: z.number().int().min(1).max(200).optional(),
      },
    },
    async (args) => textResult({ tasks: await listTasks(apiKey.actingUser, args) })
  );

  server.registerTool(
    "criar_tarefa",
    {
      title: "Criar tarefa",
      description: "Cria uma tarefa em um negócio.",
      inputSchema: {
        dealId: z.string().uuid(),
        title: z.string().min(1),
        type: z.enum(["mensagem", "ligacao", "agendamento", "generica", "email"]).default("generica"),
        dueAt: z.string().datetime().optional().describe("ISO 8601, opcional"),
      },
    },
    async ({ dealId, title, type, dueAt }) => {
      const result = await createTaskForApiKey(apiKey, { dealId, title, type, dueAt: dueAt ?? null });
      if (!result.ok) return errorResult(result.error);
      return textResult(result.data);
    }
  );

  server.registerTool(
    "concluir_tarefa",
    {
      title: "Concluir tarefa",
      description: "Marca uma tarefa como concluída.",
      inputSchema: { taskId: z.string().uuid() },
    },
    async ({ taskId }) => {
      const result = await completeTaskForApiKey(apiKey, taskId);
      if (!result.ok) return errorResult(result.error);
      return textResult(result.data);
    }
  );

  // ---------- Central de Ajuda (Etapa 30) ----------
  // Disponível em QUALQUER escopo (operacional ou admin) — é conteúdo de
  // ajuda, não dado sensível do CRM. actingUser.role filtra artigos
  // admin-only (mesmo critério usado nas páginas /ajuda).

  server.registerTool(
    "listar_categorias_ajuda",
    {
      title: "Listar categorias de ajuda",
      description: "Lista as categorias da Central de Ajuda, cada uma com seus artigos de referência.",
      inputSchema: {},
    },
    async () => {
      const categories = await listHelpCategories();
      const articlesByCategory = await listReferenceArticlesByCategory(apiKey.actingUser.role);
      return textResult({
        categories: categories
          .map((c) => ({
            name: c.name,
            slug: c.slug,
            articles: (articlesByCategory.get(c.id) ?? []).map((a) => ({ title: a.title, slug: a.slug })),
          }))
          .filter((c) => c.articles.length > 0),
      });
    }
  );

  server.registerTool(
    "buscar_artigos_ajuda",
    {
      title: "Buscar artigos de ajuda",
      description: "Busca artigos de referência da Central de Ajuda por palavra-chave no título ou conteúdo.",
      inputSchema: { query: z.string().min(1) },
    },
    async ({ query }) => {
      const results = await searchHelpArticles(query, apiKey.actingUser.role);
      return textResult({
        results: results.map((r) => ({
          title: r.title,
          categoria: r.categorySlug,
          slug: r.slug,
        })),
      });
    }
  );

  server.registerTool(
    "obter_artigo_ajuda",
    {
      title: "Obter artigo de ajuda",
      description: "Retorna o conteúdo completo de um artigo de referência da Central de Ajuda.",
      inputSchema: { categoria: z.string(), slug: z.string() },
    },
    async ({ categoria, slug }) => {
      const article = await getReferenceArticle(categoria, slug, apiKey.actingUser.role);
      if (!article) return errorResult("Artigo não encontrado.");
      return textResult({
        title: article.title,
        categoria: article.categorySlug,
        conteudo: article.content,
      });
    }
  );

  // ---------- Configuração do CRM (Part B — só chave admin) ----------

  if (hasAdminScope(apiKey)) {
    server.registerTool(
      "listar_canais",
      {
        title: "Listar canais",
        description: "Lista os canais (WhatsApp/Instagram) conectados, com status — nunca inclui credenciais.",
        inputSchema: {},
      },
      async () => {
        const result = await listChannelsForApiKey(apiKey);
        if (!result.ok) return errorResult(result.error);
        return textResult({ channels: result.data });
      }
    );

    // ---- Pipelines ----
    server.registerTool(
      "listar_pipelines",
      { title: "Listar pipelines", description: "Lista todas as pipelines do CRM.", inputSchema: {} },
      async () => {
        const result = await listPipelinesForApiKey(apiKey);
        if (!result.ok) return errorResult(result.error);
        return textResult({ pipelines: result.data });
      }
    );
    server.registerTool(
      "criar_pipeline",
      {
        title: "Criar pipeline",
        description: "Cria uma nova pipeline de vendas.",
        inputSchema: { name: z.string().min(1) },
      },
      async ({ name }) => {
        const result = await createPipelineForApiKey(apiKey, { name });
        if (!result.ok) return errorResult(result.error);
        return textResult(result.data);
      }
    );
    server.registerTool(
      "editar_pipeline",
      {
        title: "Editar pipeline",
        description: "Renomeia uma pipeline existente.",
        inputSchema: { pipelineId: z.string().uuid(), name: z.string().min(1) },
      },
      async ({ pipelineId, name }) => {
        const result = await updatePipelineForApiKey(apiKey, pipelineId, { name });
        if (!result.ok) return errorResult(result.error);
        return textResult(result.data);
      }
    );
    server.registerTool(
      "excluir_pipeline",
      {
        title: "Excluir pipeline",
        description: "Exclui uma pipeline — bloqueado se houver negócios nela.",
        inputSchema: { pipelineId: z.string().uuid() },
      },
      async ({ pipelineId }) => {
        const result = await deletePipelineForApiKey(apiKey, pipelineId);
        if (!result.ok) return errorResult(result.error);
        return textResult(result.data);
      }
    );

    // ---- Etapas ----
    server.registerTool(
      "listar_etapas",
      {
        title: "Listar etapas",
        description: "Lista as etapas de uma pipeline.",
        inputSchema: { pipelineId: z.string().uuid() },
      },
      async ({ pipelineId }) => {
        const result = await listStagesForApiKey(apiKey, pipelineId);
        if (!result.ok) return errorResult(result.error);
        return textResult({ stages: result.data });
      }
    );
    server.registerTool(
      "criar_etapa",
      {
        title: "Criar etapa",
        description: "Cria uma nova etapa numa pipeline.",
        inputSchema: { pipelineId: z.string().uuid(), name: z.string().min(1), color: z.string().optional().nullable() },
      },
      async (args) => {
        const result = await createStageForApiKey(apiKey, args);
        if (!result.ok) return errorResult(result.error);
        return textResult(result.data);
      }
    );
    server.registerTool(
      "editar_etapa",
      {
        title: "Editar etapa",
        description: "Renomeia/recolore uma etapa existente.",
        inputSchema: { stageId: z.string().uuid(), name: z.string().min(1), color: z.string().optional().nullable() },
      },
      async ({ stageId, ...params }) => {
        const result = await updateStageForApiKey(apiKey, stageId, params);
        if (!result.ok) return errorResult(result.error);
        return textResult(result.data);
      }
    );
    server.registerTool(
      "excluir_etapa",
      {
        title: "Excluir etapa",
        description: "Exclui uma etapa — bloqueado se houver negócios nela.",
        inputSchema: { stageId: z.string().uuid() },
      },
      async ({ stageId }) => {
        const result = await deleteStageForApiKey(apiKey, stageId);
        if (!result.ok) return errorResult(result.error);
        return textResult(result.data);
      }
    );

    // ---- Motivos de perda ----
    server.registerTool(
      "listar_motivos_perda",
      {
        title: "Listar motivos de perda",
        description:
          "Lista os motivos de perda cadastrados numa pipeline — use pra descobrir o lossReasonId " +
          "necessário em editar_negocio quando status=\"perdido\".",
        inputSchema: { pipelineId: z.string().uuid() },
      },
      async ({ pipelineId }) => {
        const result = await listLossReasonsForApiKey(apiKey, pipelineId);
        if (!result.ok) return errorResult(result.error);
        return textResult({ lossReasons: result.data });
      }
    );

    // ---- Tarefas automáticas de etapa ----
    const stageTaskType = z.enum(["mensagem", "ligacao", "agendamento", "generica", "email"]);
    server.registerTool(
      "listar_tarefas_automaticas_etapa",
      {
        title: "Listar tarefas automáticas da etapa",
        description: "Lista as tarefas-modelo configuradas pra uma etapa.",
        inputSchema: { stageId: z.string().uuid() },
      },
      async ({ stageId }) => {
        const result = await listStageTasksForApiKey(apiKey, stageId);
        if (!result.ok) return errorResult(result.error);
        return textResult({ stageTasks: result.data });
      }
    );
    server.registerTool(
      "configurar_tarefa_automatica_etapa",
      {
        title: "Configurar tarefa automática de etapa",
        description: "Cria uma tarefa (modelo) que roda quando um negócio entra numa etapa.",
        inputSchema: {
          stageId: z.string().uuid(),
          title: z.string().min(1),
          type: stageTaskType,
          messageTemplateId: z.string().uuid().optional().nullable(),
          emailTemplateId: z.string().uuid().optional().nullable(),
          daysToComplete: z.number().int().min(0).optional().nullable(),
          triggerDelayMinutes: z.number().int().min(0).optional().nullable(),
          isAutomatic: z.boolean().optional(),
          autoSend: z.boolean().optional(),
          autoSendChannelId: z.string().uuid().optional().nullable(),
        },
      },
      async (args) => {
        const result = await createStageTaskForApiKey(apiKey, args);
        if (!result.ok) return errorResult(result.error);
        return textResult(result.data);
      }
    );
    server.registerTool(
      "editar_tarefa_automatica_etapa",
      {
        title: "Editar tarefa automática de etapa",
        description: "Edita uma tarefa-modelo de etapa existente.",
        inputSchema: {
          stageTaskId: z.string().uuid(),
          title: z.string().min(1),
          messageTemplateId: z.string().uuid().optional().nullable(),
          emailTemplateId: z.string().uuid().optional().nullable(),
          daysToComplete: z.number().int().min(0).optional().nullable(),
          triggerDelayMinutes: z.number().int().min(0).optional().nullable(),
          isAutomatic: z.boolean().optional(),
          autoSend: z.boolean().optional(),
          autoSendChannelId: z.string().uuid().optional().nullable(),
        },
      },
      async ({ stageTaskId, ...params }) => {
        const result = await updateStageTaskForApiKey(apiKey, stageTaskId, params);
        if (!result.ok) return errorResult(result.error);
        return textResult(result.data);
      }
    );
    server.registerTool(
      "excluir_tarefa_automatica_etapa",
      {
        title: "Excluir tarefa automática de etapa",
        description: "Exclui uma tarefa-modelo de etapa.",
        inputSchema: { stageTaskId: z.string().uuid() },
      },
      async ({ stageTaskId }) => {
        const result = await deleteStageTaskForApiKey(apiKey, stageTaskId);
        if (!result.ok) return errorResult(result.error);
        return textResult(result.data);
      }
    );

    // ---- Campos customizados ----
    server.registerTool(
      "listar_campos_customizados",
      {
        title: "Listar campos customizados",
        description: "Lista os campos customizados de negócio e/ou contato.",
        inputSchema: { entity: z.enum(["deal", "contact"]).optional() },
      },
      async ({ entity }) => {
        const result = await listCustomFieldsForApiKey(apiKey, entity);
        if (!result.ok) return errorResult(result.error);
        return textResult({ customFields: result.data });
      }
    );
    server.registerTool(
      "criar_campo_customizado",
      {
        title: "Criar campo customizado",
        description: "Cria um novo campo customizado pra negócio ou contato.",
        inputSchema: {
          entity: z.enum(["deal", "contact"]),
          key: z.string().min(1).describe("letras minúsculas, números e underscore, começando com letra"),
          label: z.string().min(1),
          type: z.enum(["texto", "numero", "select", "data"]),
          options: z.array(z.object({ value: z.string(), label: z.string() })).optional().nullable(),
        },
      },
      async (args) => {
        const result = await createCustomFieldForApiKey(apiKey, args);
        if (!result.ok) return errorResult(result.error);
        return textResult(result.data);
      }
    );
    server.registerTool(
      "editar_campo_customizado",
      {
        title: "Editar campo customizado",
        description: "Edita o label/opções de um campo customizado.",
        inputSchema: {
          fieldId: z.string().uuid(),
          label: z.string().min(1),
          options: z.array(z.object({ value: z.string(), label: z.string() })).optional().nullable(),
        },
      },
      async ({ fieldId, ...params }) => {
        const result = await updateCustomFieldForApiKey(apiKey, fieldId, params);
        if (!result.ok) return errorResult(result.error);
        return textResult(result.data);
      }
    );
    server.registerTool(
      "excluir_campo_customizado",
      {
        title: "Excluir campo customizado",
        description: "Exclui um campo customizado.",
        inputSchema: { fieldId: z.string().uuid() },
      },
      async ({ fieldId }) => {
        const result = await deleteCustomFieldForApiKey(apiKey, fieldId);
        if (!result.ok) return errorResult(result.error);
        return textResult(result.data);
      }
    );

    // ---- Tags ----
    server.registerTool(
      "listar_tags",
      { title: "Listar tags", description: "Lista todas as tags cadastradas.", inputSchema: {} },
      async () => {
        const result = await listTagsForApiKey(apiKey);
        if (!result.ok) return errorResult(result.error);
        return textResult({ tags: result.data });
      }
    );
    server.registerTool(
      "criar_tag",
      {
        title: "Criar tag",
        description: "Cria uma nova tag.",
        inputSchema: { name: z.string().min(1), color: z.string().optional().nullable() },
      },
      async (args) => {
        const result = await createTagForApiKey(apiKey, args);
        if (!result.ok) return errorResult(result.error);
        return textResult(result.data);
      }
    );
    server.registerTool(
      "editar_tag",
      {
        title: "Editar tag",
        description: "Renomeia/recolore uma tag existente.",
        inputSchema: { tagId: z.string().uuid(), name: z.string().min(1), color: z.string().optional().nullable() },
      },
      async ({ tagId, ...params }) => {
        const result = await updateTagForApiKey(apiKey, tagId, params);
        if (!result.ok) return errorResult(result.error);
        return textResult(result.data);
      }
    );
    server.registerTool(
      "excluir_tag",
      {
        title: "Excluir tag",
        description: "Exclui uma tag (remove das associações existentes).",
        inputSchema: { tagId: z.string().uuid() },
      },
      async ({ tagId }) => {
        const result = await deleteTagForApiKey(apiKey, tagId);
        if (!result.ok) return errorResult(result.error);
        return textResult(result.data);
      }
    );

    // ---- Templates de mensagem ----
    server.registerTool(
      "listar_templates_mensagem",
      { title: "Listar templates de mensagem", description: "Lista os templates de mensagem.", inputSchema: {} },
      async () => {
        const result = await listMessageTemplatesForApiKey(apiKey);
        if (!result.ok) return errorResult(result.error);
        return textResult({ messageTemplates: result.data });
      }
    );
    server.registerTool(
      "criar_template_mensagem",
      {
        title: "Criar template de mensagem",
        description: "Cria um template de mensagem (variáveis {{campo}} detectadas automaticamente).",
        inputSchema: { name: z.string().min(1), content: z.string().min(1) },
      },
      async (args) => {
        const result = await createMessageTemplateForApiKey(apiKey, args);
        if (!result.ok) return errorResult(result.error);
        return textResult(result.data);
      }
    );
    server.registerTool(
      "editar_template_mensagem",
      {
        title: "Editar template de mensagem",
        description: "Edita um template de mensagem existente.",
        inputSchema: { templateId: z.string().uuid(), name: z.string().min(1), content: z.string().min(1) },
      },
      async ({ templateId, ...params }) => {
        const result = await updateMessageTemplateForApiKey(apiKey, templateId, params);
        if (!result.ok) return errorResult(result.error);
        return textResult(result.data);
      }
    );
    server.registerTool(
      "excluir_template_mensagem",
      {
        title: "Excluir template de mensagem",
        description: "Exclui um template de mensagem.",
        inputSchema: { templateId: z.string().uuid() },
      },
      async ({ templateId }) => {
        const result = await deleteMessageTemplateForApiKey(apiKey, templateId);
        if (!result.ok) return errorResult(result.error);
        return textResult(result.data);
      }
    );

    // ---- Templates de email ----
    server.registerTool(
      "listar_templates_email",
      { title: "Listar templates de email", description: "Lista os templates de email.", inputSchema: {} },
      async () => {
        const result = await listEmailTemplatesForApiKey(apiKey);
        if (!result.ok) return errorResult(result.error);
        return textResult({ emailTemplates: result.data });
      }
    );
    server.registerTool(
      "criar_template_email",
      {
        title: "Criar template de email",
        description: "Cria um template de email (assunto + corpo).",
        inputSchema: { name: z.string().min(1), subject: z.string().min(1), content: z.string().min(1) },
      },
      async (args) => {
        const result = await createEmailTemplateForApiKey(apiKey, args);
        if (!result.ok) return errorResult(result.error);
        return textResult(result.data);
      }
    );
    server.registerTool(
      "editar_template_email",
      {
        title: "Editar template de email",
        description: "Edita um template de email existente.",
        inputSchema: {
          templateId: z.string().uuid(),
          name: z.string().min(1),
          subject: z.string().min(1),
          content: z.string().min(1),
        },
      },
      async ({ templateId, ...params }) => {
        const result = await updateEmailTemplateForApiKey(apiKey, templateId, params);
        if (!result.ok) return errorResult(result.error);
        return textResult(result.data);
      }
    );
    server.registerTool(
      "excluir_template_email",
      {
        title: "Excluir template de email",
        description: "Exclui um template de email.",
        inputSchema: { templateId: z.string().uuid() },
      },
      async ({ templateId }) => {
        const result = await deleteEmailTemplateForApiKey(apiKey, templateId);
        if (!result.ok) return errorResult(result.error);
        return textResult(result.data);
      }
    );

    // ---- Automações de tag ----
    server.registerTool(
      "listar_automacoes_tag",
      { title: "Listar automações de tag", description: "Lista as automações disparadas por tag.", inputSchema: {} },
      async () => {
        const result = await listTagAutomationsForApiKey(apiKey);
        if (!result.ok) return errorResult(result.error);
        return textResult({ tagAutomations: result.data });
      }
    );
    server.registerTool(
      "criar_automacao_tag",
      {
        title: "Criar automação de tag",
        description: "Cria uma automação que gera uma tarefa quando uma tag é adicionada a um negócio (ou X tempo depois).",
        inputSchema: {
          tagId: z.string().uuid(),
          title: z.string().min(1),
          type: stageTaskType,
          trigger: z.enum(["tag_adicionada", "dias_apos_tag"]),
          delayMinutes: z.number().int().min(0).optional().nullable(),
          messageTemplateId: z.string().uuid().optional().nullable(),
          autoSend: z.boolean().optional(),
          autoSendChannelId: z.string().uuid().optional().nullable(),
        },
      },
      async (args) => {
        const result = await createTagAutomationForApiKey(apiKey, args);
        if (!result.ok) return errorResult(result.error);
        return textResult(result.data);
      }
    );
    server.registerTool(
      "editar_automacao_tag",
      {
        title: "Editar automação de tag",
        description: "Edita uma automação de tag existente.",
        inputSchema: {
          automationId: z.string().uuid(),
          tagId: z.string().uuid(),
          title: z.string().min(1),
          type: stageTaskType,
          trigger: z.enum(["tag_adicionada", "dias_apos_tag"]),
          delayMinutes: z.number().int().min(0).optional().nullable(),
          messageTemplateId: z.string().uuid().optional().nullable(),
          autoSend: z.boolean().optional(),
          autoSendChannelId: z.string().uuid().optional().nullable(),
        },
      },
      async ({ automationId, ...params }) => {
        const result = await updateTagAutomationForApiKey(apiKey, automationId, params);
        if (!result.ok) return errorResult(result.error);
        return textResult(result.data);
      }
    );
    server.registerTool(
      "excluir_automacao_tag",
      {
        title: "Excluir automação de tag",
        description: "Exclui uma automação de tag.",
        inputSchema: { automationId: z.string().uuid() },
      },
      async ({ automationId }) => {
        const result = await deleteTagAutomationForApiKey(apiKey, automationId);
        if (!result.ok) return errorResult(result.error);
        return textResult(result.data);
      }
    );

    // ---- Sequências de automação ----
    server.registerTool(
      "listar_sequencias_automacao",
      { title: "Listar sequências de automação", description: "Lista as sequências de automação.", inputSchema: {} },
      async () => {
        const result = await listAutomationSequencesForApiKey(apiKey);
        if (!result.ok) return errorResult(result.error);
        return textResult({ automationSequences: result.data });
      }
    );
    server.registerTool(
      "detalhar_sequencia_automacao",
      {
        title: "Detalhar sequência de automação",
        description: "Busca uma sequência de automação com seus passos.",
        inputSchema: { sequenceId: z.string().uuid() },
      },
      async ({ sequenceId }) => {
        const result = await getAutomationSequenceForApiKey(apiKey, sequenceId);
        if (!result.ok) return errorResult(result.error);
        return textResult(result.data);
      }
    );
    server.registerTool(
      "criar_sequencia_automacao",
      {
        title: "Criar sequência de automação",
        description:
          "Cria uma sequência de automação completa (gatilho + passos) — ex: mensagem, tarefa genérica, tag ou mudar etapa, cada um com atraso configurável.",
        inputSchema: {
          name: z.string().min(1),
          active: z.boolean().optional(),
          triggerType: z.enum(["etapa", "tag", "sem_resposta"]),
          triggerStageId: z.string().uuid().optional().nullable(),
          triggerTagId: z.string().uuid().optional().nullable(),
          noResponseDays: z.number().int().min(1).optional().nullable(),
          conditions: z
            .object({ field: z.string(), operator: z.enum(["eq", "gt", "lt", "contains"]), value: z.string() })
            .optional()
            .nullable(),
          steps: z.array(sequenceStepSchema).min(1),
        },
      },
      async (args) => {
        const result = await createAutomationSequenceForApiKey(apiKey, args);
        if (!result.ok) return errorResult(result.error);
        return textResult(result.data);
      }
    );
    server.registerTool(
      "editar_sequencia_automacao",
      {
        title: "Editar sequência de automação",
        description: "Substitui nome/gatilho/passos de uma sequência existente.",
        inputSchema: {
          sequenceId: z.string().uuid(),
          name: z.string().min(1),
          active: z.boolean().optional(),
          triggerType: z.enum(["etapa", "tag", "sem_resposta"]),
          triggerStageId: z.string().uuid().optional().nullable(),
          triggerTagId: z.string().uuid().optional().nullable(),
          noResponseDays: z.number().int().min(1).optional().nullable(),
          conditions: z
            .object({ field: z.string(), operator: z.enum(["eq", "gt", "lt", "contains"]), value: z.string() })
            .optional()
            .nullable(),
          steps: z.array(sequenceStepSchema).min(1),
        },
      },
      async ({ sequenceId, ...params }) => {
        const result = await updateAutomationSequenceForApiKey(apiKey, sequenceId, params);
        if (!result.ok) return errorResult(result.error);
        return textResult(result.data);
      }
    );
    server.registerTool(
      "excluir_sequencia_automacao",
      {
        title: "Excluir sequência de automação",
        description: "Exclui uma sequência de automação.",
        inputSchema: { sequenceId: z.string().uuid() },
      },
      async ({ sequenceId }) => {
        const result = await deleteAutomationSequenceForApiKey(apiKey, sequenceId);
        if (!result.ok) return errorResult(result.error);
        return textResult(result.data);
      }
    );

    // ---- Webhooks ----
    server.registerTool(
      "listar_webhooks",
      {
        title: "Listar webhooks",
        description: "Lista os webhooks de entrada e saída configurados (nunca inclui secretToken).",
        inputSchema: {},
      },
      async () => {
        const result = await listWebhooksForApiKey(apiKey);
        if (!result.ok) return errorResult(result.error);
        return textResult({ webhooks: result.data });
      }
    );
    server.registerTool(
      "configurar_webhook",
      {
        title: "Configurar webhook",
        description:
          "Cria um webhook de entrada (captura de lead externo) ou saída (notifica um sistema externo em eventos do CRM).",
        inputSchema: {
          direction: z.enum(["entrada", "saida"]),
          name: z.string().min(1),
          defaultPipelineId: z.string().uuid().optional().nullable().describe("obrigatório se direction='entrada'"),
          defaultStageId: z.string().uuid().optional().nullable().describe("obrigatório se direction='entrada'"),
          targetUrl: z.string().url().optional().nullable().describe("obrigatório se direction='saida'"),
          events: z.array(z.string()).optional().describe("obrigatório se direction='saida'"),
          pipelineId: z.string().uuid().optional().nullable(),
          stageId: z.string().uuid().optional().nullable(),
        },
      },
      async (args) => {
        const result = await createWebhookForApiKey(apiKey, args);
        if (!result.ok) return errorResult(result.error);
        return textResult(result.data);
      }
    );
    server.registerTool(
      "editar_webhook",
      {
        title: "Editar webhook",
        description: "Edita um webhook existente (mesmos campos de configurar_webhook).",
        inputSchema: {
          webhookId: z.string().uuid(),
          direction: z.enum(["entrada", "saida"]),
          name: z.string().min(1),
          defaultPipelineId: z.string().uuid().optional().nullable(),
          defaultStageId: z.string().uuid().optional().nullable(),
          targetUrl: z.string().url().optional().nullable(),
          events: z.array(z.string()).optional(),
          pipelineId: z.string().uuid().optional().nullable(),
          stageId: z.string().uuid().optional().nullable(),
        },
      },
      async ({ webhookId, ...params }) => {
        const result = await updateWebhookForApiKey(apiKey, webhookId, params);
        if (!result.ok) return errorResult(result.error);
        return textResult(result.data);
      }
    );
    server.registerTool(
      "excluir_webhook",
      {
        title: "Excluir webhook",
        description: "Exclui um webhook.",
        inputSchema: { webhookId: z.string().uuid() },
      },
      async ({ webhookId }) => {
        const result = await deleteWebhookForApiKey(apiKey, webhookId);
        if (!result.ok) return errorResult(result.error);
        return textResult(result.data);
      }
    );
  }

  return server;
}

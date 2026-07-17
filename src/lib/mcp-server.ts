import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { AuthenticatedApiKey } from "@/lib/api-keys";
import {
  completeTaskForApiKey,
  createTaskForApiKey,
  getDeal,
  getDealConversation,
  listDeals,
  listTasks,
  moveDealStageForApiKey,
  sendMessageForApiKey,
} from "@/lib/api-v1";

function textResult(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

function errorResult(message: string) {
  return { content: [{ type: "text" as const, text: `Erro: ${message}` }], isError: true };
}

// Um McpServer novo por request HTTP (modo stateless — ver src/app/api/mcp/
// route.ts): os tools fecham sobre a api_key já autenticada desta chamada,
// então cada tool reaproveita exatamente as mesmas funções de negócio da
// API REST (src/lib/api-v1.ts) — mesmo filtro/permissão/escopo dos dois
// lados, um só lugar pra manter (ver critério de aceite da Etapa 28).
export function createMcpServer(apiKey: AuthenticatedApiKey): McpServer {
  const server = new McpServer({ name: "viagente-crm", version: "1.0.0" });

  server.registerTool(
    "list_deals",
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
    async (args) => {
      const deals = await listDeals(apiKey.actingUser, args);
      return textResult({ deals });
    }
  );

  server.registerTool(
    "get_deal",
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
    "get_deal_conversation",
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
    "move_deal_stage",
    {
      title: "Mover negócio de etapa",
      description: "Move um negócio pra outra etapa do pipeline. Requer chave com escopo de escrita.",
      inputSchema: { dealId: z.string().uuid(), stageId: z.string().uuid() },
    },
    async ({ dealId, stageId }) => {
      const result = await moveDealStageForApiKey(apiKey, dealId, stageId);
      if (!result.ok) return errorResult(result.error);
      return textResult(result.data);
    }
  );

  server.registerTool(
    "list_tasks",
    {
      title: "Listar tarefas",
      description: "Lista tarefas, opcionalmente filtradas por negócio e status.",
      inputSchema: {
        dealId: z.string().uuid().optional(),
        status: z.enum(["pendente", "concluida"]).optional(),
        limit: z.number().int().min(1).max(200).optional(),
      },
    },
    async (args) => {
      const tasks = await listTasks(apiKey.actingUser, args);
      return textResult({ tasks });
    }
  );

  server.registerTool(
    "create_task",
    {
      title: "Criar tarefa",
      description: "Cria uma tarefa em um negócio. Requer chave com escopo de escrita.",
      inputSchema: {
        dealId: z.string().uuid(),
        title: z.string().min(1),
        type: z.enum(["mensagem", "ligacao", "agendamento", "generica"]).default("generica"),
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
    "complete_task",
    {
      title: "Concluir tarefa",
      description: "Marca uma tarefa como concluída. Requer chave com escopo de escrita.",
      inputSchema: { taskId: z.string().uuid() },
    },
    async ({ taskId }) => {
      const result = await completeTaskForApiKey(apiKey, taskId);
      if (!result.ok) return errorResult(result.error);
      return textResult(result.data);
    }
  );

  server.registerTool(
    "send_message",
    {
      title: "Enviar mensagem",
      description:
        "Envia uma mensagem de texto via WhatsApp pro contato informado. Requer chave com escopo de escrita.",
      inputSchema: {
        channelId: z.string().uuid(),
        contactId: z.string().uuid(),
        message: z.string().min(1),
      },
    },
    async ({ channelId, contactId, message }) => {
      const result = await sendMessageForApiKey(apiKey, { channelId, contactId, message });
      if (!result.ok) return errorResult(result.error);
      return textResult(result.data);
    }
  );

  return server;
}

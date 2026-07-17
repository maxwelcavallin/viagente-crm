# Prompt — Etapa 28: API Pública + Servidor MCP (operacional + configuração)

## Contexto
Expor o CRM pra ser consultado/operado por agentes de IA (Claude e outros), reaproveitando toda a lógica de negócio já construída. **Escopo ampliado** em relação à primeira versão: agora inclui também as ações de configuração (pipelines, automações, campos, etc.), não só as operacionais — com controle de escopo pra separar as duas coisas, já que dar acesso de reconfiguração total é sensível.

## Migration necessária
```
api_keys (id, label, key_hash,
          scope ['operacional','admin'],  -- operacional: negócios/contatos/mensagens/tarefas
                                            -- admin: tudo do operacional + configuração completa
          created_by_user_id, last_used_at,
          active default true, created_at)
```

## Tarefas

### A. API pública REST — escopo operacional (qualquer API key)
1. Endpoints de leitura: listar/detalhar negócios, contatos, mensagens (histórico de conversa), tarefas — com filtros equivalentes aos já usados nas telas (Etapa 8)
2. Endpoints de ação: mover negócio de etapa, criar/editar negócio e contato, criar tarefa, marcar tarefa como concluída, enviar mensagem (Etapa 5), enviar email de atividade (Etapa 26), adicionar/remover tag

### B. API pública REST — escopo admin (só API key com `scope='admin'`)
3. CRUD completo de: pipelines e etapas (Etapa 4), `stage_tasks` (Etapa 9), campos customizados (Etapa 7), tags (Etapa 7), templates de mensagem e de email (Etapas 9/26), `automation_sequences` e `tag_automations` (Etapa 22), `webhook_configs` de entrada e saída (Etapa 10)
4. Leitura (não escrita) de canais de comunicação e seu status — WhatsApp/Instagram (Etapa 5/25): nome, status de conexão, mas **nunca** retornar token/credencial em nenhuma resposta de API, mesmo criptografado
5. **Não expor via API/MCP, em nenhum escopo:** criação/edição de usuários e suas roles, geração/gestão de outras API keys, credenciais de canais (Z-API, Instagram, Google, LeadDelta, email) — essas ações continuam exclusivas da UI em `/configuracoes`, logado como humano

### C. Autenticação e proteção
6. Autenticação por API key (header `Authorization: Bearer`), gerada em `/configuracoes` → API, escolhendo o escopo (`operacional` ou `admin`) no momento da criação
7. Rate limiting por chave, mais restritivo pra chaves `admin`
8. Log de auditoria (reaproveitar `deal_activity_log` da Etapa 24, com `source='webhook'` ou um novo valor `'api'`) pra toda ação de escrita feita via API/MCP — precisa ficar rastreável quem (qual chave) fez o quê

### D. Servidor MCP
9. Servidor MCP (remoto, seguindo a especificação do Model Context Protocol) expondo como *tools* tudo da Parte A sempre, e tudo da Parte B só quando a chave conectada for `admin`
10. Documentar a URL do servidor MCP e como conectar (Claude Desktop, Claude.ai, outros clientes MCP)
11. Nomear as tools de forma clara pra um agente entender o que cada uma faz sem ambiguidade (ex: `criar_pipeline`, `configurar_tarefa_automatica_etapa`, `criar_negocio`, `mover_negocio_etapa`, `enviar_mensagem_whatsapp`)

## Critérios de aceite
- API key `operacional` consegue ler/agir sobre negócios, contatos, tarefas, mensagens, mas é rejeitada ao tentar criar uma pipeline ou automação
- API key `admin` consegue fazer tudo isso e também configurar pipeline, `stage_tasks`, campos, tags, templates, sequências de automação e webhooks
- Nenhuma resposta de API, em nenhum escopo, retorna credencial de canal em texto puro nem criptografado
- Toda ação de escrita via API fica registrada no log de auditoria, identificando a chave usada
- Servidor MCP responde a um cliente real (Claude Desktop ou equivalente): consegue **configurar uma pipeline nova com etapas e tarefa automática**, e depois **criar um negócio, mover de etapa e enviar mensagem** — tudo numa sessão, usando uma chave `admin`
- Chave revogada/inativa deixa de funcionar imediatamente, em ambos os escopos

## Fora do escopo desta etapa
Não implementar OAuth pra terceiros (só API key). Não expor gestão de usuários/roles nem credenciais de canais via API/MCP, em nenhum escopo — essas ações continuam exclusivas da UI humana.

# Especificação Técnica — CRM Viagente

**Objetivo:** substituir a Clint como CRM + canal de atendimento WhatsApp da Viagente, com MVP em produção em 7 dias.

**Como usar este documento:** é a especificação de referência para implementação via Claude Code. Cada seção tem contexto suficiente para servir de prompt/base de tarefa. Não é exaustivo em código — é o "o quê" e o "porquê"; o "como" (implementação linha a linha) fica a cargo do Claude Code.

---

## 1. Contexto de negócio (resumo funcional pro modelo de dados)

A Viagente é uma consultoria de otimização de viagens (ticket ~R$7.000/ano). O funil oficial é:

```
Calculadora (topo) → Diagnóstico (qualificação) → Agendamento → Reunião → Venda
```

O Diagnóstico coleta: frequência de viagens, gasto anual com viagens, gasto mensal no cartão, perfil profissional, mentalidade (delega vs. faz sozinho). Esses dados chegam via webhook e devem virar **campos customizados do negócio**, e a partir deles o sistema calcula automaticamente a **temperatura do lead**:

| Temperatura | Critério |
|---|---|
| 🟢 Quente | cartão ≥ R$20k/mês **e** 3+ viagens/ano **e** prefere delegar |
| 🟡 Morno | perfil intermediário |
| 🔴 Frio | baixo gasto, não viaja, perfil "faz você mesmo" |

Isso deve ser uma **regra de negócio configurável** (não hardcoded), pois os critérios podem mudar.

**Referência para as integrações futuras (webhook de entrada, seção 6):**
- Calculadora (topo de funil): `https://calculadora.viagt.com.br/`
- Diagnóstico (qualificação, fonte principal de negócio): `https://diagnostico.viagt.com.br/`
- Site institucional: `https://www.viagente.com.br/`

---

## 2. Escopo do MVP (Dia 1 — obrigatório pra desligar a Clint)

1. Contatos + Negócios (deals) com campos customizados e tags
2. Pipelines com etapas configuráveis
3. Tarefa padrão automática ao entrar em uma etapa
4. Execução de tarefa em 1 clique (ex: disparar mensagem template)
5. Atendimento via WhatsApp (Z-API): inbox, envio, histórico persistido
6. Motor de webhook de entrada genérico com mapeamento de campos via UI (sem precisar de deploy pra nova integração)
7. Admin: convidar usuário, criar pipeline/etapa/campo/tag
8. Migração de negócios e contatos **ativos** da Clint (sem histórico de mensagens antigo)
9. Cálculo automático de temperatura do lead

## 3. Fora do MVP (Fase 2 — logo em seguida, não bloqueia o cutover)

- API pública + servidor MCP (para agentes de IA)
- Dashboards / indicadores
- Automações condicionais avançadas
- Criação de instâncias novas diretamente na Z-API (gerenciamento continua sendo feito manualmente na própria Z-API; o CRM só consome credenciais já existentes)

---

## 4. Stack e infraestrutura

| Camada | Escolha | Motivo |
|---|---|---|
| Banco de dados | **Neon (Postgres serverless)** | scale-to-zero economiza custo com 1-3 usuários; storage barato ($0,35/GB-mês) |
| Compute/deploy | Vercel (ou stack equivalente que o Claude Code definir) | já conectado ao workspace |
| Mídia (áudio, imagem, PDF do WhatsApp) | Object storage (Cloudflare R2 ou S3) — **nunca em bytea no Postgres** | mídia é o que mais explode custo de banco relacional |
| WhatsApp | Z-API (1 instância = 1 número) | já em uso, sem limite de mensagens |

**Configuração de custo no Neon:**
- Plano Launch, autoscaling com teto baixo (1-2 CU) — só 3 atendentes
- Scale-to-zero ativado fora do horário comercial
- Histórico de instant restore curto (não precisa de 30 dias de PITR nesse estágio)

---

## 5. Modelo de dados (schema de referência)

```sql
-- USUÁRIOS
users (id, name, email, role ['admin','atendente'], created_at)

-- PIPELINES E ETAPAS
pipelines (id, name, "order", created_at)
stages (id, pipeline_id, name, "order", color)

-- TAREFA PADRÃO POR ETAPA (definição)
stage_tasks (id, stage_id, title, type ['mensagem','ligacao','agendamento','generica'],
             message_template_id nullable, "order")

-- CONTATOS
contacts (id, name, phone, email, custom_fields jsonb, created_at)

-- NEGÓCIOS
deals (id, contact_id, pipeline_id, stage_id, owner_id,
       title, value, source, status ['aberto','ganho','perdido'],
       custom_fields jsonb,      -- gasto_mensal_cartao, viagens_ano, mentalidade, etc.
       temperature ['quente','morno','frio'] nullable,
       created_at, updated_at)

-- TAREFAS (instâncias, geradas a partir de stage_tasks ao mudar de etapa)
tasks (id, deal_id, stage_task_id nullable, title, type,
       status ['pendente','concluida'], due_at, completed_at, completed_by)

-- TAGS
tags (id, name, color)
deal_tags (deal_id, tag_id)

-- CAMPOS CUSTOMIZADOS (definição dinâmica, alimenta a UI de admin)
custom_field_definitions (id, entity ['deal','contact'], key, label,
                           type ['texto','numero','select','data'],
                           options jsonb, "order")

-- MENSAGENS (particionar por mês — ver seção 7)
messages (id, deal_id, contact_id, channel_id, direction ['entrada','saida'],
          type ['texto','imagem','audio','documento','video'],
          content text, media_url text,
          status ['enviado','entregue','lido','falhou'],
          z_api_message_id text, created_at)

-- CANAIS WHATSAPP (configurados via UI no CRM — suporta múltiplos números)
whatsapp_channels (id, label, zapi_instance_id,
                    zapi_token,        -- criptografado em repouso
                    zapi_client_token, -- criptografado em repouso
                    phone_number, status ['conectado','desconectado','pendente'],
                    is_default, created_at)

-- CONTROLE DE ACESSO POR CANAL (modelo de bloqueio, não de liberação — ver seção 7)
whatsapp_channel_restrictions (id, user_id, channel_id, created_at, UNIQUE(user_id, channel_id))

-- TEMPLATES DE MENSAGEM
message_templates (id, name, content, variables jsonb)

-- MOTOR DE WEBHOOK GENÉRICO (ver seção 6) — suporta entrada e saída (Etapa 10)
webhook_configs (id, name, direction ['entrada','saida'], active,
                  source_platform,
                  secret_token, field_mapping jsonb,           -- só entrada
                  default_pipeline_id, default_stage_id,       -- só entrada
                  target_url, events jsonb,                    -- só saida
                  created_at)
webhook_logs (id, webhook_config_id, direction ['entrada','saida'], payload jsonb,
              status ['sucesso','erro'], error_message, created_at)

-- REGRA DE TEMPERATURA (configurável, não hardcoded)
temperature_rules (id, name, conditions jsonb, result ['quente','morno','frio'], priority)
```

**Por que `custom_fields jsonb` e não EAV com tabelas separadas:** dado o prazo de 1 semana e o volume de dados, jsonb com `custom_field_definitions` guiando a UI é a opção mais rápida de implementar e ainda permite filtro/index via `jsonb` GIN index se precisar depois.

---

## 6. Motor de webhook de entrada (a peça mais crítica — "não pode faltar")

Esse é o equivalente ao que a Clint chama de "criar integração via webhook mapeando campos". Fluxo:

1. Admin cria um `webhook_config`: nome (ex: "Diagnóstico"), gera uma URL única (`/api/webhooks/inbound/{id}`) e um `secret_token`.
2. Admin define o **mapeamento de campos** via UI: de que chave do JSON recebido vem o quê (nome → `payload.nome`, telefone → `payload.whatsapp`, gasto mensal → `payload.gasto_cartao`, etc.) — isso é salvo em `field_mapping` (jsonb).
3. Quando o endpoint recebe um POST:
   - Valida o `secret_token`
   - Aplica o `field_mapping` sobre o payload recebido
   - Busca contato existente por telefone; se não existir, cria
   - Cria negócio na pipeline/etapa padrão configurada pra aquele webhook
   - Aplica `temperature_rules` sobre os `custom_fields` resultantes
   - Loga o resultado em `webhook_logs` (sucesso/erro, payload bruto)
4. Se o mapeamento falhar (campo esperado ausente), loga erro mas **não derruba o webhook** — grava o payload bruto pra reprocessamento manual depois.

**Integrações do dia 1:** Calculadora e Diagnóstico.
**Integrações que entram depois usando a mesma engine, sem código novo:** Facebook, LeadDelta e as demais — só criar novo `webhook_config` e mapear campos.

**Teste do motor sem integração real (Etapa 10):** antes de conectar a Calculadora e o Diagnóstico de verdade, a tela de cada webhook de entrada tem um botão "Enviar payload de teste" — cola um JSON de exemplo e valida a engine inteira (mapeamento, criação de contato/negócio, cálculo de temperatura) sem depender de nenhum formulário externo. A Calculadora e o Diagnóstico reais são conectados manualmente depois, cadastrando um webhook de entrada pra cada um e mapeando os campos deles.

**Webhook de saída (Etapa 10, antecipado — não é mais Fase 2):** o mesmo `webhook_config` (com `direction='saida'`) dispara um POST assíncrono pra uma `target_url` quando um dos eventos configurados acontece (negócio criado, etapa alterada, negócio ganho, negócio perdido). Falha no disparo de saída nunca bloqueia a ação principal do CRM — é fire-and-forget, com log de erro.

---

## 7. Integração WhatsApp (Z-API)

- **Configuração via UI, não por variável de ambiente.** O CRM tem uma tela de administração (`whatsapp_channels`) onde o admin cadastra as credenciais de cada instância Z-API já existente (instance id, token, client-token). O sistema suporta **múltiplos números conectados simultaneamente** (ex: comercial, suporte) — cada um é um `whatsapp_channel`.
- Credenciais (`zapi_token`, `zapi_client_token`) ficam **criptografadas em repouso** no banco, nunca em texto puro.
- Z-API **não armazena histórico de mensagens** — a persistência é 100% responsabilidade do CRM.
- Cada canal tem sua **própria URL de webhook** (`/api/whatsapp/webhook/[channelId]`), configurada no painel da Z-API daquela instância — assim o CRM sempre sabe de qual número veio o evento, sem depender do payload pra identificar a origem.
  - `on-message-received`: identifica contato pelo telefone (cria se não existir) → grava em `messages` (direction=entrada, `channel_id` do canal) → se houver negócio aberto vinculado, associa; senão fica só vinculado ao contato até um atendente criar/mover negócio
  - `on-message-status` (SENT/DELIVERED/READ): atualiza o campo `status` da mensagem correspondente pelo `z_api_message_id`
- Envio de mensagem: endpoint interno `/api/messages/send` recebe `channel_id` + destino + conteúdo, chama a API de envio da Z-API com as credenciais daquele canal, grava a mensagem em `messages` com `direction=saida` e `status=enviado`, depois atualiza pelo webhook de status.
- Mídia recebida: baixar do link temporário da Z-API e subir pro object storage (R2/S3) — não deixar dependente do link da Z-API, que expira.
- **Particionamento:** tabela `messages` particionada por mês (`created_at`) — mantém performance de leitura de conversa mesmo com volume alto, e facilita arquivar depois.
- **Vínculo garantido a contato e negócio:** toda mensagem (entrada ou saída) é sempre gravada com `contact_id` preenchido. Se o contato tiver um negócio com `status='aberto'`, a mensagem também recebe o `deal_id` correspondente automaticamente — assim o histórico aparece tanto na visão de atendimento quanto dentro do negócio. Se o contato tiver mais de um negócio aberto, usar o mais recentemente atualizado (heurística aceitável no MVP, com 1-3 atendentes).
- **Exportação do histórico em `.md`:** botão "Exportar conversa" que gera um arquivo Markdown com o histórico completo (mensagens em ordem cronológica, identificando remetente, canal, timestamps, e links de mídia) e dispara o download em um clique. Endpoint reutilizável (`GET /api/conversations/{contactId}/export`) para ser usado tanto na tela de atendimento quanto, futuramente, na página do negócio.
- **Controle de acesso por canal:** por padrão, **todo atendente enxerga todos os canais**. O admin pode restringir manualmente o acesso de um atendente a um canal específico (ex: só quem cuida de suporte vê o número de suporte) via `whatsapp_channel_restrictions` — a presença de uma linha ali bloqueia aquele usuário daquele canal. `role = 'admin'` sempre vê todos os canais, independente de restrição. Ao listar/exportar conversas, mensagens de canais restritos pro usuário atual não devem aparecer, mesmo que o contato tenha conversado por mais de um canal.

---

## 8. Automação de tarefa por etapa

- Ao mover um `deal` de `stage_id` A para B: sistema busca todos os `stage_tasks` da etapa B e cria uma `task` pendente pra cada, vinculada ao `deal`.
- Se o `stage_task.type = 'mensagem'`, a UI mostra um botão de "executar" que abre a mensagem já preenchida (via `message_template`) pronta pra enviar com 1 clique — ao enviar, marca a `task` como concluída automaticamente.

---

## 9. Migração da Clint (negócios/contatos ativos, sem histórico de mensagens)

Como não há confirmação de API de exportação da Clint neste documento, o caminho mais confiável é:
1. Exportar CSV de negócios ativos e contatos pela própria interface da Clint (a maioria dos CRMs tem exportação em Configurações ou na visão de lista).
2. Script de importação (`scripts/import-clint.ts` ou `.py`) que lê o CSV, mapeia colunas pra `contacts` e `deals`, cria negócios na pipeline/etapa correspondente (mapear nome da etapa da Clint pra etapa nova).
3. Rodar em ambiente de staging primeiro, validar contagem e amostra antes de rodar em produção.

> Antes de começar o Dia 6 (migração), confirme com a Clint se existe exportação nativa ou API — isso muda o esforço do script.

---

## 10. Plano de execução — 7 dias

| Dia | Entregas |
|---|---|
| 1 | Setup (Neon, deploy, repo), schema/migrations, auth + convite de usuário, CRUD pipelines/etapas |
| 2 | CRUD contatos/negócios, campos customizados dinâmicos, tags, filtros |
| 3 | Automação de tarefa por etapa + execução em 1 clique + templates de mensagem |
| 4 | Integração Z-API: webhook de recebimento, envio, persistência de histórico, inbox de atendimento |
| 5 | Motor de webhook de entrada genérico + UI de mapeamento de campos + conectar Calculadora e Diagnóstico + regra de temperatura |
| 6 | Migração de negócios/contatos ativos da Clint + testes ponta a ponta |
| 7 | QA, correção de bugs, cutover (desligar Clint, ligar CRM novo) |

> **Nota:** esse é o plano original de 7 dias, mantido aqui como referência histórica. A sequência real de execução evoluiu (WhatsApp e Design System foram antecipados, e alguns dias viraram várias etapas menores) — a numeração e o conteúdo atualizados de cada etapa estão em `docs/dia1-etapas/`, junto com o prompt e o checklist de teste de cada uma.

---

## 11. Fase 2 (logo após o cutover)

- **API pública + MCP**: expor `deals`, `contacts`, `messages`, `tasks` como recursos MCP — leitura (histórico de conversa, negócios por etapa) e ações (mover etapa, criar tarefa, enviar mensagem)
- **Dashboard**: visão geral por pipeline/dono, tempo médio por etapa
- Conectar Facebook, LeadDelta e demais integrações via `webhook_configs`

---

## 12. Pipeline e campos sugeridos (pré-configuração inicial)

**Pipeline "Funil Viagente":**
Calculadora → Diagnóstico preenchido → Lead qualificado → Agendamento marcado → Reunião realizada → Proposta enviada → Cliente ativo

**Campos customizados (entity=deal):**
`gasto_mensal_cartao` (número), `gasto_anual_viagens` (número), `frequencia_viagens_ano` (número), `perfil_profissional` (texto), `mentalidade` (select: delega / faz sozinho), `economia_estimada` (número, calculado)

**Regra de temperatura padrão** (carregar em `temperature_rules`):
- 🟢 quente: `gasto_mensal_cartao >= 20000 AND frequencia_viagens_ano >= 3 AND mentalidade = 'delega'`
- 🔴 frio: `gasto_mensal_cartao < 10000 OR frequencia_viagens_ano < 1 OR mentalidade = 'faz_sozinho'`
- 🟡 morno: demais casos

---

## 13. Design System (referência oficial de UI, a partir da Etapa 6)

Fonte única de verdade para toda estilização do produto — qualquer tela nova deve seguir isso, não os defaults do shadcn/Tailwind.

- **Estrutura/UX de referência:** Clint (kanban de pipeline, sidebar de origens, painel de atendimento) — layout e comportamento, não cor.
- **Cor/tipografia de referência:** marca Viagente (dourado `#E59501` sobre neutros quentes, fonte Inter única).
- **Modo claro é o padrão**, com toggle pra escuro (preferência persistida).
- **Dourado é exclusivo de marca/ação primária** (botões primários, links, foco, navegação ativa). **Cores semânticas (verde/amarelo/vermelho/azul)** são permitidas como exceção só para dado pontual (temperatura do lead, status de mensagem, sucesso/erro) — sempre como bolinha/badge pequeno + texto, nunca como fundo grande, banner ou gradiente, e nunca como cor de botão primário.
- **Zero sombra, blur ou glow** — profundidade vem de contraste de borda.
- **Raio de borda:** 12px em cards/painéis, 8px em botões/inputs, 999px em avatares/pills.
- Tokens completos (variáveis CSS para os dois modos) estão no prompt da Etapa 6 (`etapa-6-design-system.md`).

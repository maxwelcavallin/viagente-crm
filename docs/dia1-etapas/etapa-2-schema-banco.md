# Prompt — Etapa 2: Schema do Banco de Dados + Seed (Dia 1, CRM Viagente)

## Contexto
Continuação do CRM da Viagente. A Etapa 1 (setup do projeto Next.js + Drizzle + Neon + deploy) já está concluída. Leia `viagente-crm-spec.md` novamente, especialmente as **seções 5 (Modelo de dados), 6 (Motor de webhook), 11 (Fase 2) e 12 (Pipeline e campos sugeridos)** — o schema que você vai criar precisa comportar tudo isso, mesmo que a lógica de negócio venha em etapas futuras.

## Objetivo desta etapa
Criar TODAS as tabelas do MVP via migration do Drizzle (mesmo as que só serão usadas em etapas futuras — é mais barato criar o schema completo agora do que migrar de novo depois) e popular com um seed inicial.

## Tarefas
1. Criar os schemas Drizzle para todas as tabelas listadas na seção 5 da spec, **mais a tabela `whatsapp_channels` (nova, ver abaixo)**:
   `users`, `pipelines`, `stages`, `stage_tasks`, `contacts`, `deals`, `tasks`, `tags`, `deal_tags`, `custom_field_definitions`, `messages`, `message_templates`, `webhook_configs`, `webhook_logs`, `temperature_rules`, `whatsapp_channels`
   - Use os tipos e enums exatamente como descritos na spec (ex: `status` de deal é `['aberto','ganho','perdido']`)
   - `custom_fields` em `contacts` e `deals` deve ser `jsonb`
   - `messages` deve ser particionada por mês (`created_at`) — se o Drizzle não suportar partitioning nativo de forma limpa, pode implementar via SQL raw na migration, mas documente a decisão
   - Adicione índices: `(contact_id, created_at)` em `messages`; índice único em `contacts.phone`; índice em `deals.stage_id`

   **Nova tabela `whatsapp_channels`** (o CRM vai suportar múltiplos números WhatsApp conectados via Z-API, configurados pela própria interface, não por variável de ambiente):
   ```
   whatsapp_channels (
     id, label,                        -- nome amigável, ex: "Comercial", "Suporte"
     zapi_instance_id text,
     zapi_token text,                  -- armazenar criptografado (ver Etapa 5)
     zapi_client_token text,           -- armazenar criptografado (ver Etapa 5)
     phone_number text,
     status ['conectado','desconectado','pendente'],
     is_default boolean,
     created_at
   )
   ```
   - `messages` precisa ganhar a coluna `channel_id` (FK para `whatsapp_channels`), pra saber por qual número aquela conversa passou
2. Rodar a migration e confirmar que sobe do zero sem erro
3. Criar um script de seed (`scripts/seed.ts` ou equivalente) que popula:
   - Pipeline **"Funil Viagente"** com as 7 etapas na ordem exata da seção 12: Calculadora → Diagnóstico preenchido → Lead qualificado → Agendamento marcado → Reunião realizada → Proposta enviada → Cliente ativo
   - As 6 definições de campo customizado da seção 12 (`gasto_mensal_cartao`, `gasto_anual_viagens`, `frequencia_viagens_ano`, `perfil_profissional`, `mentalidade`, `economia_estimada`)
   - As 3 `temperature_rules` padrão da seção 12 (🟢 quente, 🟡 morno, 🔴 frio), com as condições exatamente como descritas
4. Documentar no README como rodar migration e seed (`npm run db:migrate`, `npm run db:seed` ou equivalente)

## Critérios de aceite
- Migration roda do zero (banco vazio) sem erro
- Todas as 16 tabelas existem no banco com os tipos corretos
- Seed cria a pipeline com as 7 etapas na ordem certa
- Seed cria os 6 campos customizados
- Seed cria as 3 regras de temperatura com as condições certas
- Rodar a migration/seed duas vezes não duplica dados (idempotente) ou o comando de reset está documentado

## Fora do escopo desta etapa
Não crie autenticação (Etapa 3). Não crie nenhuma UI ainda — isso é só schema, migration e seed via script/CLI.

---

> **Nota:** logo em seguida a esta etapa existe um complemento (`etapa-2b-complemento-whatsapp-channels.md`) adicionando a tabela `whatsapp_channel_restrictions`, que veio de uma decisão posterior sobre controle de acesso por canal. Rode esse complemento antes da Etapa 5.

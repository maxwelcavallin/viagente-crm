# Prompt — Complemento à Etapa 2: adicionar suporte a canais WhatsApp

## Contexto
A Etapa 2 (schema + seed) já foi implementada e está funcionando. Depois disso, a especificação foi atualizada (arquivo `viagente-crm-spec.md` no repositório, já substituído pela versão mais recente) para que a integração WhatsApp suporte múltiplos números configurados pela própria interface do CRM, em vez de variável de ambiente. Isso requer duas mudanças no schema que ainda não existem no banco atual.

**Não recrie o schema do zero. Isso é uma migration incremental em cima do que já existe.** Se você seguiu a versão mais recente do prompt da Etapa 2, as tabelas `whatsapp_channels` e a coluna `messages.channel_id` (tarefas 1 e 2 abaixo) já podem existir — confirme antes de tentar recriá-las. O que certamente é novo é a tabela `whatsapp_channel_restrictions` (tarefa 3).

## Tarefas
1. Criar a nova tabela `whatsapp_channels`:
   ```
   whatsapp_channels (
     id, label,                        -- nome amigável, ex: "Comercial", "Suporte"
     zapi_instance_id text,
     zapi_token text,                  -- será armazenado criptografado, na Etapa 5
     zapi_client_token text,           -- será armazenado criptografado, na Etapa 5
     phone_number text,
     status ['conectado','desconectado','pendente'],
     is_default boolean,
     created_at
   )
   ```
2. Adicionar a coluna `channel_id` (FK nullable para `whatsapp_channels.id`) na tabela `messages` já existente
3. Criar a tabela `whatsapp_channel_restrictions` (controle de acesso por usuário/canal — ver seção 7 da spec atualizada):
   ```
   whatsapp_channel_restrictions (
     id,
     user_id,     -- FK users
     channel_id,  -- FK whatsapp_channels
     created_at,
     UNIQUE(user_id, channel_id)
   )
   ```
   **Modelo é de bloqueio, não de liberação:** por padrão todo atendente enxerga todos os canais. A presença de uma linha nesta tabela significa que aquele usuário está **bloqueado** daquele canal específico. Usuários com `role = 'admin'` sempre têm acesso a todos os canais, independente desta tabela.
4. Gerar e rodar a migration do Drizzle normalmente (`drizzle-kit generate` + `migrate`, ou o comando equivalente já usado no projeto) — **sem** apagar ou recriar as tabelas existentes
5. Confirmar que os dados já existentes nas outras tabelas (inclusive o seed da pipeline "Funil Viagente") continuam intactos depois da migration

## Critérios de aceite
- Tabela `whatsapp_channels` existe com os campos acima
- Tabela `whatsapp_channel_restrictions` existe com constraint única em `(user_id, channel_id)`
- `messages.channel_id` existe como FK nullable
- Migration rodou sem apagar dados existentes (pipeline, etapas, campos customizados e regras de temperatura do seed continuam lá)
- Projeto continua rodando normalmente (`npm run dev`) depois da migration

## Fora do escopo
Não implemente ainda a tela de administração de canais, a tela de gestão de acesso por usuário, criptografia dos tokens, nem a lógica de envio/recebimento — isso é a Etapa 5, que vem depois de Auth (Etapa 3) e Pipelines (Etapa 4).

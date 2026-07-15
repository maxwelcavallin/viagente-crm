# Prompt — Etapa 25: Instagram Direct como Canal de Atendimento

## Contexto
Instagram é a origem "Tráfego Insta" já prevista na estrutura de funil da Viagente. Diferente do LinkedIn, o Instagram **tem API oficial de mensageria** (Instagram Messaging API, parte da plataforma Meta for Developers) — é o caminho recomendado aqui, sem envolver automação de sessão/scraping.

**Design system obrigatório:** `docs/dia1-etapas/etapa-6-design-system.md`.

## ⚠️ Parte 1 — Configuração manual na Meta (você faz, não o Claude Code)
1. Ter (ou criar) uma **Conta Comercial do Instagram** vinculada a uma Página do Facebook
2. Criar um app em [developers.facebook.com](https://developers.facebook.com), adicionar o produto **Instagram Graph API** / **Messenger**
3. Gerar um **token de acesso de longa duração** pra Página vinculada à conta do Instagram
4. Configurar a **URL de webhook** do app apontando pro endpoint que será criado na Parte 2, e assinar o campo `messages`
5. Anotar: `Instagram Business Account ID`, `Page Access Token`, `App Secret` (usado pra validar a assinatura do webhook)

## Parte 2 — Prompt pro Claude Code

### Migration necessária
```
instagram_channels (id, label, ig_business_account_id, page_access_token encriptado,
                     app_secret encriptado, status ['conectado','desconectado'],
                     is_default, created_at)
instagram_channel_restrictions (id, user_id, channel_id, UNIQUE(user_id, channel_id))
                                -- mesmo modelo de bloqueio da Etapa 5
```
`messages.source` ganha o valor `'instagram'` (já é enum extensível desde a Etapa 20); `messages.channel_id` passa a poder referenciar tanto `whatsapp_channels` quanto `instagram_channels` — ajustar pra uma referência polimórfica simples (ex: `channel_type` + `channel_id` sem FK rígida, ou duas colunas nullable `whatsapp_channel_id`/`instagram_channel_id`, o que for mais simples de manter no ORM escolhido)

### Tarefas
1. Tela `/configuracoes` → Instagram: cadastrar canal (label, IDs, tokens — criptografados, mascarados após salvar), igual ao padrão da Etapa 5
2. Endpoint de webhook `/api/instagram/webhook/[channelId]`: validar assinatura via `app_secret`, processar evento de mensagem recebida, criar/atualizar contato (por Instagram user ID, já que não há telefone), gravar em `messages` com `source='instagram'`
3. Envio de mensagem: endpoint reaproveitando o composer já existente do `/atendimento` (Etapa 5b), chamando a API de envio do Instagram Graph API
4. Controle de acesso por canal, igual ao modelo de `whatsapp_channel_restrictions`
5. `/atendimento` passa a listar conversas de Instagram junto com WhatsApp, distinguidas por ícone, no mesmo padrão unificado já usado pro LinkedIn (Etapa 20, mas ali é só leitura — aqui é bidirecional de verdade)

## Critérios de aceite
- Mensagem recebida no Instagram aparece em `/atendimento` com o ícone certo
- Responder pela UI chega de verdade no Instagram do contato
- Controle de acesso por canal funciona igual ao WhatsApp
- Assinatura do webhook é validada antes de processar qualquer evento
- Toda a UI nova usa exclusivamente os tokens/componentes do design system da Etapa 6

## Fora do escopo desta etapa
Não implementar Stories/comentários do Instagram, só Direct Messages. Não implementar envio de mídia nesta etapa inicial (pode ser complemento depois, mesmo padrão da Etapa 5b).

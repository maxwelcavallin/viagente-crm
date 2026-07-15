# Prompt — Etapa 26: Email como Canal de Atendimento

## Contexto
Adicionar email como mais um canal unificado em `/atendimento`, ao lado de WhatsApp e Instagram.

**Design system obrigatório:** `docs/dia1-etapas/etapa-6-design-system.md`.

## ⚠️ Parte 1 — Configuração manual (você faz, não o Claude Code)
1. Escolher um provedor transacional com **suporte a recebimento via webhook** (ex: Postmark "Inbound Parse", SendGrid "Inbound Parse", ou Resend + um serviço de inbound parse compatível) — precisa dar conta de enviar E receber, não só enviar
2. Criar conta no provedor escolhido, gerar API Key de envio
3. Configurar um subdomínio de recebimento (ex: `atendimento@viagente.com.br` ou `inbox.viagente.com.br`) apontando os registros MX pro provedor, conforme a documentação dele
4. Configurar o webhook de recebimento do provedor pra apontar pro endpoint que será criado na Parte 2

## Parte 2 — Prompt pro Claude Code

### Migration necessária
```
email_channels (id, label, from_address, provider ['postmark','sendgrid','resend'],
                 api_key encriptado, inbound_webhook_secret encriptado,
                 status, is_default, created_at)
```
`messages.source` ganha o valor `'email'`; mensagens de email usam `content` pro corpo (aceitar HTML básico) e um campo `subject` novo em `messages` (nullable, só se aplica a email)

### Tarefas
1. Tela `/configuracoes` → Email: cadastrar canal (label, endereço de envio, provedor, API key criptografada)
2. Endpoint de webhook de recebimento (`/api/email/webhook/[channelId]`): valida a assinatura do provedor, identifica contato pelo email (cria se não existir), grava mensagem em `messages` com `source='email'`, mantendo o `subject` e vinculando pela thread (usar `In-Reply-To`/`References` do cabeçalho do email, se disponível, pra agrupar como conversa)
3. Envio: endpoint que usa a API do provedor escolhido, respeitando o mesmo composer unificado de `/atendimento`
4. `/atendimento` mostra emails na mesma lista de conversas, com ícone próprio, mostrando o assunto quando aplicável

## Critérios de aceite
- Email recebido no endereço configurado aparece em `/atendimento`, identificando o contato certo
- Responder pela UI chega de verdade como email de resposta, mantendo a thread quando possível
- Toda a UI nova usa exclusivamente os tokens/componentes do design system da Etapa 6

## Fora do escopo desta etapa
Não implementar anexos de email nesta etapa inicial. Não implementar templates de email com HTML rico — usar o mesmo `message_templates` já existente, em texto simples por enquanto.

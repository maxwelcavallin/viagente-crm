# Prompt — Etapa 26: Envio de Email a partir de Atividades

## Contexto
Mudança de escopo em relação à ideia original: email **não** vira um canal de atendimento como WhatsApp/Instagram (sem inbox unificado, sem recebimento). Em vez disso, email é um **tipo de atividade/tarefa**, do mesmo jeito que já existe "ligação" e "agendamento" (Etapa 9) — o atendente dispara o envio de um email a partir de um negócio, com parâmetros, texto e anexos, igual ao padrão de uso de email da Clint. É bem mais simples que a versão anterior: só envio, sem recebimento nem webhook de entrada.

**Design system obrigatório:** `docs/dia1-etapas/etapa-6-design-system.md`.

## ⚠️ Parte 1 — Configuração manual (você faz, não o Claude Code)
Bem mais simples que uma inbox completa — só precisa de envio:
1. Criar conta num provedor transacional de envio (ex: Resend, Postmark, SendGrid) — qualquer um serve, já que é só outbound
2. Gerar a API Key de envio
3. Configurar SPF/DKIM do domínio de envio (`viagente.com.br` ou subdomínio) conforme a documentação do provedor, pra não cair em spam — não precisa de MX nem inbound parse, já que não vamos receber resposta pelo CRM

## Parte 2 — Prompt pro Claude Code

### Migration necessária
```
email_settings (id, from_address, from_name, provider ['resend','postmark','sendgrid'],
                 api_key encriptado, created_at)   -- config única, mesmo padrão de whatsapp_channels mas 1 registro

email_templates (id, name, subject, content, variables jsonb, created_at)
                 -- mesmo espírito do message_templates já existente, mas com subject

emails_sent (id, deal_id, contact_id, task_id nullable,
             to_email, subject, body, attachments jsonb,  -- attachments: array de {filename, url}
             sent_by_user_id, status ['enviado','falhou'], error_message nullable,
             sent_at)
```
`stage_tasks.type` ganha o valor `'email'` (enum já existente: `['mensagem','ligacao','agendamento','generica']` → adicionar `'email'`)

### Tarefas

#### A. Templates de email
1. Em `/configuracoes` → Templates, adicionar uma seção (ou aba) de templates de email: nome, assunto (com variáveis `{{nome_contato}}`, `{{valor}}`, campos customizados, etc. — reaproveitar a mesma lógica de variáveis do `message_templates` da Etapa 9), corpo do email (texto, aceitar formatação básica), preview com dados de exemplo

#### B. Configuração do canal de envio
2. Em `/configuracoes` → Email: cadastrar remetente (endereço, nome, provedor, API key criptografada e mascarada após salvar)

#### C. Tarefa tipo "email"
3. Admin pode configurar `stage_tasks` do tipo `email` (igual já faz com mensagem/ligação/agendamento), vinculando a um `email_template` opcional
4. No detalhe do negócio (painel de tarefas, Etapa 8c/9), uma tarefa tipo `email` mostra botão **"Enviar email"**
5. Ao clicar, abre um modal de composição: destinatário (pré-preenchido com o email do contato, editável), assunto (pré-preenchido pelo template se houver, com variáveis já substituídas), corpo (idem), e um campo de **anexos** (upload de arquivo, reaproveitando o mesmo object storage R2/S3 já usado pra mídia do WhatsApp)
6. Ao enviar: chama a API do provedor configurado, grava em `emails_sent`, marca a `task` como concluída automaticamente (mesmo padrão da tarefa de mensagem)
7. Também deve ser possível **disparar um email avulso** a partir do negócio, sem precisar de uma tarefa pré-existente — mesmo modal, acionado por um botão "Enviar email" solto no detalhe do negócio (mesmo padrão do botão avulso de agendamento da Etapa 12)

#### D. Histórico
8. Emails enviados aparecem listados no detalhe do negócio (pode ser a mesma aba de histórico da Etapa 24, ou uma seção própria "Emails enviados") — mostrando destinatário, assunto, data, status de envio, e os anexos

## Critérios de aceite
- Configurar um `email_template` com variáveis e ver o preview substituindo corretamente
- Configurar uma `stage_task` tipo `email` numa etapa faz a tarefa aparecer no negócio ao entrar naquela etapa
- Executar a tarefa abre o modal já preenchido (assunto/corpo do template, variáveis substituídas), permite anexar arquivo, e o envio real funciona (chega de verdade no destinatário)
- Enviar email avulso (sem tarefa) também funciona, pelo botão solto no detalhe do negócio
- Enviar marca a tarefa correspondente como concluída, quando aplicável
- Emails enviados ficam visíveis no histórico do negócio, com anexos acessíveis
- Toda a UI nova usa exclusivamente os tokens/componentes do design system da Etapa 6

## Fora do escopo desta etapa
Não implementar recebimento de email (sem inbox, sem webhook de entrada, sem thread de conversa). Não integrar email em `/atendimento` — email não é um canal de atendimento bidirecional, é uma atividade de envio, como ligação e agendamento.

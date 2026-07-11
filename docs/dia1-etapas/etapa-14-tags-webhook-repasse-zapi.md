# Etapa 14 — Tags estáticas em webhooks de entrada + repasse de webhook Z-API

## Contexto
Duas necessidades sem relação direta entre si, mas pequenas o bastante pra ficarem numa etapa só. A primeira: identificar a origem de um contato/negócio criado por um webhook de entrada (ex: "veio da Calculadora"). A segunda: uma instância Z-API que hoje só atende o CRM Viagente vai passar a ser usada por outro sistema também — e a Z-API só aceita **uma** URL cadastrada por evento ("ao receber" / "status da mensagem"), então não dá pra simplesmente cadastrar duas.

## Objetivo desta etapa
1. Webhook de entrada consegue aplicar tags fixas em todo contato/negócio que ele cria
2. Uma instância Z-API compartilhada com outro sistema consegue mandar uma cópia de cada evento pra esse outro sistema, sem mudar a URL cadastrada na Z-API

## Tarefas

### A. Tags estáticas em webhook de entrada
1. `webhook_configs` ganha `contact_tag_ids` e `deal_tag_ids` (jsonb, array de `tags.id`) — aplicadas a **todo** contato/negócio criado por aquele webhook, sempre as mesmas, nunca vindas do payload
2. Removido `contact.tags`/`deal.tags` do vocabulário de mapeamento por payload (`webhook-fields.ts`) — decisão explícita de nunca depender de digitar um path/nome de tag num payload externo; tags de webhook são sempre selecionadas de uma lista existente (com opção de criar uma nova na hora), nunca digitadas
3. Nova seção "Tags" na tela do webhook (`/configuracoes/webhooks/[id]`), separada do mapeamento de campos — usa o mesmo seletor de tags (`TagPickerWithCreate`) já usado em outras telas

### B. Repasse de webhook Z-API
4. `whatsapp_channels` ganha `relay_webhook_url` (nullable) — se preenchida, toda vez que o endpoint `/api/whatsapp/webhook/[channelId]` recebe um evento (mensagem nova ou status), repassa uma cópia do mesmo payload cru pra essa URL, em paralelo, sem bloquear nem depender do resultado do repasse
5. Falha no repasse (timeout, erro HTTP) só loga — nunca afeta o processamento normal do evento no CRM
6. Campo configurável em Configurações > WhatsApp > \[canal] > "Repasse pra outro sistema"

## Critérios de aceite
- Contato/negócio criado por um webhook de entrada com tags configuradas já nasce com essas tags
- Mapeamento de campos do webhook não oferece mais "tags" como opção de path — só a seção própria
- Canal com `relay_webhook_url` preenchida manda uma cópia de cada evento recebido pra essa URL, sem deixar de processar normalmente
- Outro sistema fora do ar não impede o CRM de processar a mensagem recebida

## Fora do escopo desta etapa
Repasse de eventos de envio (`fromMe=true`) — só os eventos que já chegam pelo webhook (mensagem recebida e status) são repassados. Retry automático de repasse falho.

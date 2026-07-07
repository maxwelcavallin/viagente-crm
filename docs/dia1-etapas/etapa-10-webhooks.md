# Prompt — Etapa 10: Motor de Webhook (Entrada e Saída)

## Contexto
Esta etapa assume que a Etapa 8 (Negócios + Kanban real) já está pronta — o motor de webhook de entrada cria negócios de verdade, então a lógica de `deals` precisa existir. Se a Etapa 8 ainda não foi feita, pare e avise antes de continuar.

Esta é a peça mais crítica do CRM em termos de integração — é o que substitui a funcionalidade da Clint de "criar integração via webhook mapeando campos". Releia a **seção 6 (Motor de webhook de entrada)** de `viagente-crm-spec.md`.

**Importante sobre o teste desta etapa:** ainda **não vamos conectar a Calculadora nem o Diagnóstico reais**. A pessoa que está construindo isso vai, depois, cadastrar manualmente esses dois formulários reais na tela de admin (URL do formulário + mapeamento de campos), usando a engine que você vai construir agora. Por isso, esta etapa precisa incluir uma forma de **testar o motor com qualquer payload JSON de exemplo**, sem depender de nenhum formulário externo real — ver item A.5.

**Design system obrigatório:** use os tokens/componentes de `docs/dia1-etapas/etapa-6-design-system.md` (tabela, formulário, modal, dropdown, toast).

## Migration incremental necessária (schema)

A tabela `webhook_configs` já existe desde a Etapa 2, mas só cobria entrada. Adicionar:

```
webhook_configs — colunas novas:
  direction           ['entrada','saida']  default 'entrada'
  default_pipeline_id FK pipelines, nullable   -- só usado quando direction='entrada'
  default_stage_id    FK stages, nullable      -- só usado quando direction='entrada'
  target_url          text, nullable           -- só usado quando direction='saida'
  events              jsonb, nullable           -- só direction='saida': array de
                                                 -- ['negocio_criado','etapa_alterada','negocio_ganho','negocio_perdido']

webhook_logs — coluna nova:
  direction ['entrada','saida']
```

Não recrie as tabelas do zero — é migration incremental em cima do schema existente.

## Objetivo desta etapa
1. Motor de webhook de **entrada**: recebe payload externo, mapeia campos, cria contato/negócio, aplica regra de temperatura
2. Motor de webhook de **saída**: dispara evento HTTP quando algo relevante acontece no CRM
3. Forma de testar tudo isso com payload de exemplo, sem integração real ainda

## Tarefas

### A. Webhook de entrada

1. Tela `/admin/webhooks` — lista todos os webhooks (entrada e saída, com badge indicando a direção)
2. Criar webhook de entrada: nome, pipeline/etapa padrão (onde o negócio vai cair). Ao salvar, gerar:
   - URL única: `/api/webhooks/inbound/[id]`
   - `secret_token` — exibido uma única vez na tela (mesmo padrão de senha temporária da Etapa 3), pra usar como header/query param de autenticação
3. **UI de mapeamento de campos** (`/admin/webhooks/[id]`): lista à esquerda com os campos do sistema disponíveis (nome do contato, telefone, email + todos os `custom_field_definitions` de `entity='deal'` e `entity='contato'` já existentes); ao lado de cada um, um input de texto onde o usuário digita o caminho no JSON recebido (ex: `payload.nome`, `answers.gasto_cartao`) — salvar em `field_mapping` (jsonb)
4. Endpoint `POST /api/webhooks/inbound/[id]`:
   - Valida o `secret_token`
   - Aplica o `field_mapping` sobre o payload recebido
   - Busca contato existente por telefone; cria se não existir
   - Cria negócio na `default_pipeline_id`/`default_stage_id` configurada
   - Preenche `custom_fields` do negócio a partir do mapeamento
   - Aplica as `temperature_rules` cadastradas (as 3 do seed) sobre os `custom_fields` resultantes e grava em `deals.temperature`
   - Grava o resultado em `webhook_logs` (`direction='entrada'`, sucesso/erro, payload bruto, contato/negócio criado)
   - Se um campo mapeado estiver ausente no payload: **não derruba a requisição** — loga como erro parcial, salva o payload bruto pra reprocessamento manual depois
5. **Botão "Enviar payload de teste"** na tela do webhook: textarea pra colar um JSON de exemplo à mão + botão "Testar" que envia esse payload pro próprio endpoint e mostra o resultado na tela (contato/negócio criado com id, temperatura calculada, ou o erro retornado) — isso é o que permite validar a engine inteira **sem nenhum formulário externo real**, só digitando um JSON de exemplo

### B. Webhook de saída

6. Criar webhook de saída: nome, `target_url`, checkboxes de quais eventos disparam o envio (negócio criado / etapa alterada / negócio ganho / negócio perdido)
7. Ao ocorrer um desses eventos no sistema, disparar um `POST` assíncrono (fire-and-forget, não bloquear a operação principal) pra cada `target_url` cadastrado que escute aquele evento, com payload contendo os dados do negócio e do contato
8. Registrar em `webhook_logs` (`direction='saida'`) o resultado do disparo: sucesso (com status HTTP da resposta) ou erro (timeout, 4xx/5xx)
9. Falha no disparo de saída **nunca** pode impedir a ação principal (ex: criar negócio não pode falhar porque um webhook de saída deu timeout)

### C. Logs (comum às duas direções)

10. Tela/aba de logs por webhook (`/admin/webhooks/[id]` com aba "Execuções" ou rota própria): lista cronológica com status (sucesso/erro), payload bruto, mensagem de erro se houver, timestamp

## Critérios de aceite
- Criar um webhook de entrada, mapear campos, usar "Enviar payload de teste" com um JSON de exemplo, e ver o contato + negócio criados corretamente, com a temperatura certa aplicada
- Payload de teste com um campo mapeado ausente não derruba a requisição — aparece como erro logado, sem quebrar o restante
- Criar um webhook de saída apontando pra uma URL de teste (ex: um endpoint tipo webhook.site) e confirmar que o disparo acontece de fato ao criar um negócio
- Desligar/testar com a URL de saída fora do ar: a criação do negócio continua funcionando normalmente, só o log de saída registra o erro
- Logs de entrada e saída aparecem separados por direção, com payload bruto visível pra debug
- Tela usa exclusivamente os componentes do design system da Etapa 6

## Fora do escopo desta etapa
Não conectar a Calculadora nem o Diagnóstico reais — isso será feito manualmente depois, cadastrando um novo webhook de entrada pra cada um e mapeando os campos reais deles na UI que você construiu aqui. Não implementar reprocessamento automático de payloads com erro (fica só registrado no log pra ação manual).

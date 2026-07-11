# Etapa 13 — Automação avançada de tarefas (gatilhos, atraso e envio automático)

## Contexto
A Etapa 9 entregou o básico: tarefa criada automaticamente ao entrar numa etapa, sempre exigindo 1 clique humano pra executar (explicitamente fora de escopo: "não implementar envio automático de mensagem sem clique humano"). Essa etapa revoga esse limite e generaliza o conceito de "gatilho" — hoje uma tarefa pode nascer não só de "entrar na etapa", mas também de "tag adicionada a um negócio", com ou sem atraso configurável, e pode disparar a mensagem sozinha quando é do tipo `mensagem`.

## Objetivo desta etapa
1. Gatilho por etapa: manter "entrada na etapa" (comportamento original) e adicionar "X tempo depois de entrar na etapa"
2. Gatilho por tag: "tag adicionada ao negócio" (imediato) e "X tempo depois de ganhar a tag"
3. Envio automático de mensagem (`type='mensagem'`) sem esperar clique humano, quando configurado
4. Granularidade de atraso em **dias, horas e minutos** (não só dias)

## Tarefas

### A. Schema
1. `stage_tasks` ganha `trigger_delay_minutes` (nullable) — null = cria a task imediatamente ao entrar na etapa (comportamento da Etapa 9); setado = só cria quando o negócio estiver naquela etapa há esse tempo, varrido por cron
2. `stage_tasks` ganha `auto_send` (boolean) e `auto_send_channel_id` — só relevante pra `type='mensagem'`; quando ligado, a mensagem sai sozinha assim que a task é criada (ou quando `days_to_complete` vencer, se houver prazo), sem precisar do botão "Executar"
3. `deals` ganha `stage_entered_at` — timestamp de quando o negócio entrou na etapa atual, resetado toda vez que `stage_id` muda (nunca confundir com `updated_at`, que qualquer edição toca). É a base do gatilho "X tempo na etapa"
4. `deal_tags` ganha `created_at` — base do gatilho "X tempo com a tag"
5. Nova tabela `tag_automations`: `tag_id`, `trigger` (`tag_adicionada` | `dias_apos_tag`), `delay_minutes`, `title`, `type`, `message_template_id`, `auto_send`, `auto_send_channel_id` — mesma forma de `stage_tasks`, mas por tag em vez de por etapa. **Restrita a tags de negócio**, não de contato: toda task pertence a um `deal_id`, e um contato pode ter zero ou vários negócios, então "tag no contato" não tem um negócio único pra receber a task
6. `tasks` ganha `created_at` (faltava) e `tag_automation_id` (nullable) — necessários pro cron deduplicar disparos (não recriar a mesma task numa varredura seguinte)

### B. Lógica central (`src/lib/task-automation.ts`)
7. `maybeAutoSendTask`: se a task é `mensagem`, a automação de origem tem `auto_send` ligado e o prazo (se houver) já venceu, monta o texto substituindo variáveis (mesmo catálogo de `/tarefas`, ver Etapa 18) e envia via `sendTextMessage` (mesmo núcleo do composer e do agendamento de mensagem) — sucesso marca a task concluída, falha loga e deixa pendente pro cron tentar de novo
8. `fireTagAddedAutomations`: chamado sincronamente sempre que uma tag nova é anexada a um negócio (form de negócio, ação em massa, webhook de entrada, importação CSV) — cria a task na hora pras regras com `trigger='tag_adicionada'`
9. `runDelayedAutomationSweep`: usado só pelo cron — varre `stage_tasks`/`tag_automations` com atraso configurado, cria as tasks quando o tempo é atingido, e reenvia tasks `mensagem` com `auto_send` cujo prazo já venceu

### C. Cron
10. `/api/cron/task-automation`, de hora em hora (`vercel.json`), protegido por `CRON_SECRET` (mesmo padrão do cron de mensagens agendadas) — chama `runDelayedAutomationSweep`
11. A rota precisa estar na allowlist de rotas públicas do middleware de auth (`src/auth.ts`, callback `authorized`) — sem isso, o Vercel Cron (que não tem sessão) é sempre redirecionado pro login antes de chegar no `CRON_SECRET`

### D. UI
12. Em Configurações > Pipelines > editar etapa: campo "Disparar após entrar na etapa" com três inputs (Dias / Horas / Minutos, componente `DurationPicker` reaproveitável) e, só pra `type='mensagem'`, switch "Enviar automaticamente, sem clique" + select de canal
13. Nova tela `/configuracoes/automacoes`: lista as automações por tag (criar/editar/excluir), mesmo padrão de lista+form das outras telas de configuração — escolhe a tag, o gatilho (imediato ou com atraso), tipo de task, template (se mensagem) e envio automático

## Critérios de aceite
- Configurar uma `stage_task` sem atraso continua criando a task na hora, como sempre (não regressão da Etapa 9)
- Configurar atraso de X dias/horas/minutos só cria a task quando o negócio estiver naquele tempo na etapa, via cron
- Adicionar uma tag com automação `tag_adicionada` cria a task na hora, incluindo via webhook de entrada e importação CSV
- Automação com atraso por tag só dispara depois do tempo configurado, contado a partir de quando a tag foi anexada
- `auto_send` ligado numa task tipo mensagem manda a mensagem sozinha e marca concluída, sem precisar clicar em "Executar"
- Rodar o cron duas vezes seguidas sem mudar nada não duplica task nenhuma
- Vercel Cron consegue chamar `/api/cron/task-automation` sem ser redirecionado pro login

## Fora do escopo desta etapa
Gatilho de mudança de pipeline (anotado como possível próximo passo). Automação por tag de contato (só negócio, pelo motivo explicado acima).

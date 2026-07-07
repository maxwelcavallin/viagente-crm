# Prompt — Etapa 9: Automação de Tarefa por Etapa + Templates + Execução em 1 Clique

## Contexto
Etapas 1-8 concluídas (setup, schema, auth, pipelines/etapas, WhatsApp completo, design system, contatos/campos/tags, negócios/kanban com drag-and-drop funcionando). Esta etapa fecha o ciclo de "mover negócio de etapa → sistema já sugere o próximo passo" — o pedaço de automação que faz o CRM parecer inteligente no dia a dia, igual à Clint.

**Design system obrigatório:** use exclusivamente os tokens/componentes de `docs/dia1-etapas/etapa-6-design-system.md`.

A tabela `stage_tasks` (definição) e `tasks` (instâncias) já existem desde a Etapa 2. `message_templates` também já existe. Esta etapa constrói a UI e a lógica de automação em cima delas.

## Objetivo desta etapa
1. Templates de mensagem com variáveis
2. Admin configura quais tarefas são criadas automaticamente ao entrar em cada etapa
3. Ao mover um negócio de etapa (evento já existente desde a Etapa 8), criar essas tarefas automaticamente
4. Executar uma tarefa de mensagem em 1 clique, direto pro WhatsApp do negócio

## Tarefas

### A. Templates de mensagem (`/admin/templates`)
1. Listar `message_templates` existentes
2. Criar/editar template: nome, conteúdo (texto livre com variáveis no formato `{{variavel}}`, ex: `{{nome_contato}}`, `{{valor}}`, `{{economia_estimada}}`), lista de variáveis disponíveis mostrada ao lado do editor (nome do contato, campos customizados de negócio/contato já cadastrados)
3. Preview do template com dados de exemplo antes de salvar
4. Excluir template: se estiver vinculado a algum `stage_task`, avisar antes (modal de confirmação padrão)

### B. Configuração de tarefa padrão por etapa
5. Dentro de `/admin/pipelines/[id]` (tela já existente da Etapa 4), ao editar uma etapa, adicionar seção "Tarefas automáticas desta etapa"
6. Adicionar `stage_task`: título, tipo (`mensagem`, `ligacao`, `agendamento`, `generica`); se tipo=`mensagem`, selecionar qual `message_template` usar
7. Reordenar/editar/excluir `stage_tasks` de uma etapa

### C. Criação automática de tarefas ao mudar de etapa
8. Interceptar o evento de mudança de `stage_id` do kanban (já implementado na Etapa 8): ao mover um negócio pra etapa B, buscar todos os `stage_tasks` cadastrados pra B e criar uma `task` pendente pra cada, vinculada ao negócio (`deal_id`)
9. Se a etapa não tiver nenhuma `stage_task` configurada, não criar nada — não é erro, é o comportamento esperado
10. Se o negócio voltar pra uma etapa em que já esteve antes, criar as tarefas de novo (não reaproveitar tarefas antigas já concluídas)

### D. Execução de tarefa em 1 clique
11. Painel de tarefas dentro do detalhe do negócio (Etapa 8): lista de tasks pendentes e concluídas, com indicação visual clara de status
12. Task tipo `mensagem`: botão **"Executar"** abre o composer de WhatsApp (dentro do próprio detalhe do negócio ou levando pra `/atendimento` já com o texto preenchido) com o `message_template` vinculado, variáveis já substituídas pelos dados reais do negócio/contato — ao enviar a mensagem, marcar a `task` como concluída automaticamente
13. Task tipo `ligacao`, `agendamento` ou `generica`: botão **"Marcar como concluída"** simples (ação manual, sem integração automática)
14. Card do negócio no kanban mostra um indicador visual de tarefas pendentes (ex: badge com contador — usar o padrão de badge do design system)

## Critérios de aceite
- Criar um template de mensagem com variáveis e ver o preview substituindo pelos dados de exemplo corretamente
- Configurar uma `stage_task` do tipo mensagem numa etapa, vinculada a um template
- Mover um negócio pra essa etapa no kanban cria a tarefa automaticamente, sem ação manual do usuário além de arrastar o card
- Etapa sem `stage_tasks` configuradas não gera nenhuma tarefa ao receber um negócio (comportamento correto, não é bug)
- No detalhe do negócio, executar a tarefa de mensagem em 1 clique abre o WhatsApp já com o texto certo (variáveis substituídas) e, ao enviar, marca a tarefa como concluída
- Tarefas de tipo ligação/agendamento/genérica são marcadas como concluídas manualmente, sem integração automática
- Card do kanban mostra contador de tarefas pendentes do negócio
- Negócio que volta a uma etapa já visitada antes ganha tarefas novas, sem reaproveitar as antigas já concluídas
- Toda a UI nova usa exclusivamente os tokens/componentes do design system da Etapa 6

## Fora do escopo desta etapa
Não implemente lembretes ou notificações de tarefa atrasada/vencida (fica pra uma fase futura, se necessário). Não implemente envio automático de mensagem sem clique humano — a execução de tarefa de mensagem sempre depende de 1 clique de confirmação, nunca dispara sozinha.

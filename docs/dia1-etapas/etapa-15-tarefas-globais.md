# Etapa 15 — Tarefas globais (`/tarefas`) + editar/excluir tarefa

## Contexto
Até aqui, tarefas só apareciam dentro do detalhe de cada negócio (Etapa 9) — não havia visão consolidada de "tudo que preciso fazer hoje" entre negócios diferentes. Também faltava poder corrigir uma tarefa criada errada (título, tipo ou prazo) ou remover uma que não devia ter sido criada — só existiam "concluir" e "adicionar tarefa modelo".

## Objetivo desta etapa
1. Tela `/tarefas`: lista de tarefas de **todos** os negócios do usuário, com filtro de status e data
2. Editar e excluir uma tarefa, tanto em `/tarefas` quanto dentro do negócio

## Tarefas

### A. Tela `/tarefas`
1. Lista todas as `tasks` (de todos os negócios visíveis pro usuário — respeita a mesma restrição de visibilidade por dono da Etapa 19, quando aplicável), com o título do negócio e nome do contato de cada uma
2. Filtro por status (Em aberto / Atrasadas / Concluídas / Todas) e por data
3. Cada tarefa usa o mesmo executor por tipo já existente (`MessageTaskExecutor`, `SchedulingTaskExecutor` — extraídos pra `src/components/task-executors.tsx` justamente pra serem reaproveitados aqui e no detalhe do negócio, em vez de duas implementações)
4. Item de menu "Tarefas" na navegação principal

### B. Editar/excluir tarefa
5. `updateTaskAction`/`deleteTaskAction` (`src/app/negocios/actions.ts`) — editar título, tipo e prazo; excluir remove a task
6. Componentes compartilhados `EditTaskDialog`/`DeleteTaskDialog` (`src/components/`), usados tanto em `/tarefas` quanto no painel de tarefas do negócio — qualquer ajuste futuro vale nos dois lugares automaticamente

## Critérios de aceite
- `/tarefas` mostra tarefas de negócios diferentes na mesma lista, com prazo e status corretos
- Filtro de status/data funciona
- Editar título/tipo/prazo de uma tarefa funciona nas duas telas
- Excluir uma tarefa funciona nas duas telas, com confirmação

## Fora do escopo desta etapa
Reordenar tarefas manualmente. Editar em massa (só uma de cada vez).

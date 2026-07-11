# Etapa 21 — Dashboard avançado (funil, ranking, ciclo, atendimento) + filtros de tarefas

## Contexto
O dashboard (Etapa 16) cobria leads, reuniões, ganho/perdido, valor vendido, atividades, mensagens e motivos de perda — mas não mostrava onde os negócios estavam parados (funil por etapa), quem estava vendendo (ranking por dono), quanto tempo levava (ciclo médio) nem como estava o atendimento (volume de mensagens, tempo de resposta). Também não dava pra filtrar por pipeline/tag. `/tarefas` só filtrava por status e um único dia — sem dono, tipo ou intervalo de datas.

## Objetivo desta etapa
1. Filtro de pipeline e de tag no dashboard, respeitado por todo indicador existente
2. Indicadores novos: funil por etapa, ranking por vendedor, ciclo médio de venda, ticket médio, mensagens por dia, tempo médio até a primeira resposta
3. Filtros novos em `/tarefas`: dono (minhas/todas/específico), tipo de tarefa, pipeline, intervalo de datas (substitui o filtro de dia único)

## Tarefas

### A. `src/lib/dashboard.ts`
1. `getDashboardSummary(range, filters)` ganha um segundo parâmetro `{ pipelineId, tagId }`. Helper `dealScopeFilter(dealIdColumn, pipelineId, tagId)` — `sql\`true\`` quando nenhum filtro ativo, senão `inArray` contra uma subquery de `deals.id` filtrada por pipeline e/ou tag (tag via subquery em `deal_tags`). Aplicado em toda métrica que já existia (leads, reuniões, ganho/perdido, valor, atividades, mensagens, motivos de perda).
2. **Funil por etapa**: foto do momento (negócios `status='aberto'` agora, por etapa) — não filtrado por período, porque funil de prospecção é sobre a saúde atual do pipeline, não uma coorte histórica. Sempre de uma pipeline por vez: usa o filtro selecionado ou a de menor `order` como default (com aviso na UI de que é a default). Respeita filtro de tag.
3. **Ranking por vendedor**: agrupado por `deals.owner_id`, respeitando período + pipeline + tag. Top 10 por valor vendido, com contagem de ganhos/perdidos e taxa de conversão.
4. **Ciclo médio de venda + ticket médio**: `AVG(won_at - created_at)` em dias e `AVG(value)`, só negócios ganhos no período, mesmos filtros de pipeline/tag.
5. **Mensagens por dia**: agrupado por dia, sempre limitado aos últimos 90 dias independente do período escolhido (evita gráfico absurdamente longo no período "tudo"), respeita pipeline/tag via `messages.deal_id`.
6. **Tempo médio até primeira resposta**: não filtrável por pipeline/tag (é métrica de conversa, não de negócio) — só por período. Calculado via SQL cru com CTE (mesmo mecanismo de `db.execute` já usado em `/api/health`): primeira mensagem de entrada por contato, primeira saída depois dela, média da diferença em minutos.

### B. UI do dashboard (`src/app/page.tsx`)
7. Novo client component `src/components/dashboard-filters.tsx` — dois `Select` (pipeline, tag) que navegam via `router.push` preservando os outros query params; o filtro de período continua como link simples.
8. Depois da grade de tiles existente: 3 tiles novos (ciclo médio, ticket médio, tempo médio de resposta) → card "Funil por etapa" (barras horizontais, cor única da marca) → card "Ranking por vendedor" (tabela) → card "Mensagens por dia" (`src/components/daily-bar-chart.tsx`, gráfico de barras em HTML/CSS puro, sem lib de charting) → "Motivos de perda" (sem mudança estrutural, só passa a respeitar os filtros novos).

### C. Filtros de tarefas (`src/app/tarefas/page.tsx`, `tarefas-list.tsx`)
9. Query ganha `deal_owner_id`, `pipeline_id`, `pipeline_name` (join `deals` → `pipelines`, agora `innerJoin` em vez de implícito); página busca `allUsers` e `allPipelines` pra alimentar os selects.
10. Filtros novos, todos combináveis com o de status já existente: dono (todos/minhas/usuário específico, mesmo padrão de sentinelas de `deal-filters.tsx`), tipo de tarefa, pipeline, intervalo de datas (de/até, substitui o input de dia único). Cada linha de tarefa passa a mostrar o nome da pipeline também.

## Critérios de aceite
- Aplicar filtro de pipeline no dashboard muda a pipeline mostrada no funil
- Aplicar filtro de tag reduz os números de todo indicador pra só negócios com aquela tag (verificado contra contagem manual)
- Filtros de `/tarefas` isolam corretamente: dono específico, "minhas", tipo, pipeline e intervalo de datas, combinados entre si
- `npx tsc --noEmit`, `npx eslint src`, `npm run build` limpos

## Fora do escopo desta etapa
Exportar os indicadores do dashboard (CSV/PDF). Gráfico de funil com geometria de funil de verdade (optou-se por barras — mais fiel à magnitude, funil geométrico distorce percepção, ver skill `dataviz`).

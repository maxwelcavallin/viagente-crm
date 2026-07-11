# Etapa 16 — Indicadores de negócio + dashboard na Início

## Contexto
A spec original listava "Dashboards/indicadores" como Fase 2, fora do MVP (seção 3). A maioria dos eventos necessários já era gravada no schema (mensagens, tarefas concluídas, negócios criados), com uma exceção importante: **motivo de perda** — marcar um negócio como "Perdido" nunca capturou nada além do status, e **`deals.updated_at`** não serve pra filtrar "vendas deste mês" com precisão, porque qualquer edição do negócio (não só mudança de status) toca essa coluna.

## Objetivo desta etapa
1. Capturar motivo de perda (configurável por pipeline) e timestamps confiáveis de ganho/perda
2. Resumo de indicadores na página Início, com seletor de período

## Tarefas

### A. Schema
1. `deals` ganha `won_at` e `lost_at` (timestamps de transição, diferentes de `updated_at`) e `loss_reason_id`
2. Nova tabela `loss_reasons`: lista de motivos configurável pelo admin, **por pipeline** (cada pipeline pode ter categorias de perda diferentes) — painel em Configurações > Pipelines > editar pipeline > "Motivos de perda"
3. Regra de transição, tanto no caminho individual quanto em massa:
   - `-> ganho`: `won_at = now()`, `lost_at = null`, `loss_reason_id = null`
   - `-> aberto` (reabrir): limpa os dois
   - `-> perdido`: exige motivo — não é mais um clique direto; abre um diálogo (`MarkLostDialog`, compartilhado entre card do kanban, detalhe do negócio e ação em massa) pedindo o motivo antes de confirmar

### B. Dashboard — página Início
4. Seletor de período: mês atual / últimos 30 dias / tudo (link com query string, sem estado client)
5. Indicadores, todos filtrados por timestamp de evento real (não `updated_at`):
   - Leads (negócios criados no período)
   - Reuniões realizadas (tarefas tipo `agendamento` concluídas no período) + taxa de conversão sobre os leads
   - Ganho x Perdido (contagem por `won_at`/`lost_at` no período)
   - Valor total vendido (soma de `deals.value` dos ganhos no período)
   - Atividades realizadas (tarefas concluídas no período)
   - Mensagens enviadas (`direction='saida'` no período)
   - Ranking de motivos de perda no período

## Critérios de aceite
- Marcar "Perdido" sempre pede o motivo, nos três pontos de entrada (card, detalhe, ação em massa)
- Motivos de perda são específicos por pipeline, configuráveis em Configurações > Pipelines
- Início mostra os indicadores corretos pro período selecionado, batendo com os dados reais
- Trocar o dono ou editar outro campo de um negócio ganho/perdido não altera `won_at`/`lost_at`

## Fora do escopo desta etapa
Negócios já ganhos/perdidos **antes** desta etapa não têm `won_at`/`lost_at` retroativos (não dá pra reconstruir com precisão) — os indicadores por período começam a contar a partir de quando essa etapa entrou no ar. Gráficos/visualizações (só números e lista por enquanto).

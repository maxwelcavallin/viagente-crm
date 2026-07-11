# Etapa 19 — Dono do negócio/atendimento: distribuição, sincronização, filtros e visibilidade

## Contexto
Só `deals` tinha dono, e só de forma manual — sem distribuição automática, sem dono de atendimento (contato), sem filtro de dono no atendimento, sem opção "não atribuído" nos filtros, e sem forma de restringir o que um atendente enxerga.

## Objetivo desta etapa
1. Dono do atendimento (contato) existe e fica sincronizado com o dono do negócio
2. Distribuição automática de dono ao criar negócio, configurável por pipeline
3. Filtros de dono (inclusive "não atribuído") em Negócios e Atendimento
4. Restrição de visibilidade configurável por usuário, aplicada no servidor
5. Troca de dono em massa, também no atendimento (já existia em negócios)

## Tarefas

### A. Schema
1. `contacts` ganha `owner_id` — campo próprio, **sincronizado** com o dono do negócio (não é calculado a partir do negócio na hora da leitura)
2. `users` ganha `restrict_to_own_records` (boolean, por usuário — não é um interruptor global)
3. Nova tabela `pipeline_owner_distribution`: `pipeline_id`, `user_id`, `weight`, `assigned_count` — regra de distribuição por pipeline

### B. Distribuição (`src/lib/owner-distribution.ts`)
4. `resolveDistributedOwner(pipelineId)`: rodízio ponderado **determinístico** — escolhe sempre quem está mais "atrasado" em relação à cota (`assigned_count / weight`), não é sorteio; sem regra configurada, retorna null (comportamento igual a antes)
5. Chamado nos 3 pontos onde um negócio pode nascer sem dono explícito: formulário manual, webhook de entrada, importação CSV — só quando o dono não veio escolhido/mapeado
6. `syncContactOwnerFromDeal`/`syncDealOwnerFromContact`: mantêm `contacts.owner_id` e o dono do negócio aberto do contato em sincronia nas duas direções. Um negócio novo sem dono resolvido **não** apaga um dono que o contato já tinha (só sincroniza quando há de fato um dono pra propagar)

### C. Restrição de visibilidade
7. `restrict_to_own_records` incluído na sessão (JWT) do usuário, junto de `role`
8. Quem tem a flag ligada só recebe negócios/contatos **dele mesmo ou sem dono** — nunca os de outro atendente. Aplicado nas queries de `/negocios`, `/atendimento` e bloqueando acesso direto por URL ao detalhe de um negócio/contato de outro (`notFound()`). Nunca afeta `role='admin'`
9. Toggle "Restringir aos próprios negócios/atendimentos" em Configurações > Usuários > editar usuário

### D. UI
10. Configurações > Pipelines > editar pipeline > "Distribuição de donos": lista usuário + peso + quantos já recebeu (só leitura, transparência)
11. Filtro de dono em `/negocios`: "Meus negócios" e "Não atribuído" além dos usuários individuais
12. Filtro de dono em `/atendimento`: mesmo padrão ("Meus atendimentos" / "Não atribuídos" / usuário específico)
13. Seleção múltipla + "Definir dono..." em massa no atendimento (checkbox por conversa, mesmo padrão visual da seleção em massa do kanban)

## Critérios de aceite
- Pipeline com distribuição 1/1 entre dois usuários, criando negócios sem escolher dono manualmente, resulta em 50/50 exato (testado: 4 negócios seguidos = 2/2, nunca 3/1 ou pior)
- Mudar o dono de um negócio propaga pro contato; mudar o dono do atendimento propaga pro negócio aberto do contato
- Negócio novo sem dono (pipeline sem regra de distribuição) não apaga o dono que o contato já tinha
- Atendente restrito: `/negocios` e `/atendimento` mostram só os dele + não atribuídos; abrir a URL de um negócio/contato de outro atendente direto dá página não encontrada; admin nunca é afetado
- Filtro "Não atribuído" funciona nas duas telas
- Troca de dono em massa funciona no atendimento

## Fora do escopo desta etapa
Gatilho de distribuição por mudança de pipeline (só na criação). Um contato com mais de um negócio aberto em pipelines diferentes com donos diferentes: o último negócio reatribuído "vence" o dono do contato — simplificação deliberada, não um bug.

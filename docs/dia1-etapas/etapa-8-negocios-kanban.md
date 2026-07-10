# Prompt — Etapa 8: Negócios, Kanban Real e Filtros

## Contexto
Etapas 1-7 concluídas (setup, schema, auth, pipelines/etapas, WhatsApp completo, design system, contatos/campos/tags). Esta é a etapa central do CRM: os negócios de verdade e o kanban visual que os exibe — até agora só existia a *estrutura* de pipeline (nomes de etapa), sem nenhum negócio real dentro dela.

**Design system obrigatório:** use exclusivamente os tokens/componentes/padrões de `docs/dia1-etapas/etapa-6-design-system.md` — em especial a seção 3 (anatomia do card de kanban) e a seção 4 (padrões de interação de drag-and-drop), que foram desenhadas justamente pra esta etapa.

As tabelas `deals`, `tags`, `deal_tags` e `custom_field_definitions` (entity='deal') já existem desde a Etapa 2. Esta etapa constrói a UI e a lógica em cima delas.

## Objetivo desta etapa
1. Criar/editar/excluir negócios de verdade
2. Kanban real, com drag-and-drop completo seguindo as regras da Etapa 6
3. Filtros e busca

## Tarefas

### A. Criar e editar negócio
1. Botão **"Negócio +"** (padrão Clint) abre modal: título (opcional — se vazio, usar nome do contato), contato (busca com autocomplete nos contatos existentes da Etapa 7, ou opção "criar novo contato" inline sem sair do modal), pipeline (dropdown), etapa inicial (default: primeira etapa da pipeline escolhida), valor (R$, opcional), dono do negócio (`owner_id`, default o usuário logado, pode reatribuir a outro usuário), campos customizados de `entity='deal'` (renderizados dinamicamente a partir de `custom_field_definitions`, igual ao formulário de contato da Etapa 7), tags
2. Editar negócio: mesmo formulário, pré-preenchido
3. Marcar negócio como **Ganho** ou **Perdido**: ação disponível no card (menu) e no detalhe — atualiza `deals.status`; negócios ganhos/perdidos saem da visão ativa do kanban (ou ficam visualmente esmaecidos — usar o padrão de card "inativo" do design system)
4. Excluir negócio: modal de confirmação (padrão destrutivo da Etapa 6)

### B. Página/modal de detalhe do negócio (visualização completa)
5. Ao clicar num card, abrir uma visualização completa do negócio, organizada em seções claras:
   - **Dados do negócio:** título, valor, dono, pipeline/etapa atual, status, temperatura, tags, todos os campos customizados de `entity='deal'`
   - **Dados do contato:** nome, telefone, email, e todos os campos customizados de `entity='contato'` — exibidos diretamente aqui, **sem precisar navegar pra `/contatos/[id]`** (é um resumo completo do contato dentro do contexto do negócio)
   - **Tarefas:** lista de tarefas do negócio (mensagem, ligação, agendamento, genérica) com status pendente/concluída — a criação automática e execução em 1 clique são implementadas na Etapa 9, mas o painel/seção já deve existir aqui com empty state até lá
   - **Histórico de conversa:** mensagens vinculadas ao negócio (via `messages.deal_id`, já preenchido automaticamente desde a Etapa 5), com o botão "Exportar conversa (.md)" reaproveitando o endpoint existente
6. Cada seção deve permitir edição inline ou por modal (reaproveitando os componentes de formulário do design system), sem precisar recarregar a página inteira
7. Layout responsivo: em telas grandes, seções lado a lado ou em colunas; em mobile, empilhadas verticalmente (seguindo as regras de responsividade da Etapa 6)

### C. Kanban real (`/negocios`)
8. Seletor de pipeline no topo (dropdown — pode haver mais de uma pipeline cadastrada desde a Etapa 4)
9. Colunas = etapas da pipeline selecionada, na ordem correta. Header de cada coluna: nome da etapa + contador de negócios + soma de valor (R$) — conforme seção 3 do design system
10. Card do negócio segue a anatomia definida na Etapa 6: avatar do contato, nome, preview da última mensagem do WhatsApp (se houver conversa vinculada), badge de temperatura (bolinha + texto), valor em R$, tags, indicador de tempo na etapa atual (calculado a partir de quando entrou na etapa — pode usar `updated_at` como aproximação se não houver campo dedicado), ícone de atalho pra abrir a conversa em `/atendimento`

### D. Drag-and-drop (seguir a Etapa 6, seção 4, à risca)
11. Affordance de arraste (cursor grab/grabbing, scale sutil, borda dourada ao pegar)
12. Zona de destino válida com borda tracejada dourada; se não houver regra de bloqueio nesta etapa, todo destino é válido
13. Ao soltar: atualizar `stage_id` do negócio, e contador + soma de valor das colunas de origem e destino atualizam **instantaneamente**, sem reload
14. Toast de "Desfazer" por ~5s após mover
15. Acessibilidade por teclado (Tab, Espaço/Enter, setas, Esc) igual à especificação
16. Mobile: menu "Mover para..." como alternativa ao arraste
17. **Não implemente ainda** a criação automática de tarefas ao mudar de etapa — isso é a Etapa 9, que vai interceptar esse mesmo evento de mudança de `stage_id` depois

### E. Filtros e busca
18. Barra de filtros no topo do kanban (padrão Clint): por dono do negócio, por tag, por temperatura, por intervalo de data de criação, por status (aberto/ganho/perdido) — filtros combináveis (aplicam em conjunto)
19. Busca por nome do contato ou título do negócio

### F. Estados
20. Empty state quando a pipeline selecionada não tiver nenhum negócio em nenhuma etapa
21. Loading skeleton no kanban enquanto carrega

## Critérios de aceite
- Criar um negócio novo pelo botão "Negócio +", vinculando a um contato existente ou criando um novo inline
- Negócio aparece na coluna certa, com o card mostrando os dados corretos (avatar, temperatura, valor, preview de mensagem se houver)
- Arrastar um card pra outra coluna: affordance visual correta, contador/soma atualizam na hora, toast de desfazer aparece
- Mover card via teclado funciona (Tab, Espaço/Enter, setas, Esc)
- No mobile, "Mover para..." funciona como alternativa ao arraste
- Marcar negócio como Ganho/Perdido remove ele da visão ativa do kanban
- Abrir o detalhe do negócio mostra dados completos do negócio, dados do contato (sem precisar navegar pra outra tela), seção de tarefas (mesmo vazia até a Etapa 9) e o histórico de conversa vinculado, com o botão de exportar `.md` funcionando ali
- Filtros combinados (ex: dono + tag) retornam só os negócios que atendem todos os critérios ao mesmo tempo
- Busca por nome de contato/negócio funciona
- Toda a tela usa exclusivamente os tokens/componentes do design system da Etapa 6

## Fora do escopo desta etapa
Não implemente a criação automática de tarefas ao mudar de etapa, nem execução de tarefa em 1 clique — isso é a Etapa 9 (que depende desta etapa estar pronta). Não implemente dashboards/indicadores.

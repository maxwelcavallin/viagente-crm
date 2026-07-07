# Prompt — Etapa 7: Contatos, Campos Customizados e Tags

## Contexto
Etapas 1-6 concluídas (setup, schema, auth, pipelines/etapas, WhatsApp multi-canal, design system). O CRM ainda não tem nenhuma tela de **negócios de verdade** — isso é intencional, é o conteúdo desta etapa e da próxima. Esta etapa (7) constrói a base: contatos, campos customizados dinâmicos e tags. A Etapa 8 (próxima) constrói o kanban de negócios em cima dessa base.

**Design system obrigatório:** use exclusivamente os tokens e componentes definidos em `docs/dia1-etapas/etapa-6-design-system.md` (tabela, formulário, modal, dropdown, toast, empty/loading state). Não reinvente estilo — se um componente que você precisa não está descrito lá, avise antes de inventar um padrão novo.

As tabelas `contacts`, `custom_field_definitions` e `tags` já existem no schema desde a Etapa 2 — esta etapa só constrói a UI e a lógica em cima delas.

## Objetivo desta etapa
1. Tela de contatos com CRUD completo
2. Admin de campos customizados (define quais campos existem em contatos/negócios, sem precisar de código novo pra cada campo)
3. Admin de tags + atribuição de tags a um contato

## Tarefas

### A. Campos customizados (`/admin/campos`)
1. Listar `custom_field_definitions` existentes, separadas por entidade (`contato` / `negócio`)
2. Criar novo campo: label, chave (`key`, gerada a partir do label, editável), tipo (`texto`, `número`, `select`, `data`), entidade, e se for `select`, lista de opções
3. Editar label/opções de um campo existente (não permitir mudar o `type` depois de criado, pra não quebrar dado já salvo — se precisar mudar o tipo, oriente a criar um campo novo)
4. Reordenar campos (define a ordem de exibição no formulário)
5. Excluir campo: se já houver dado preenchido nesse campo em algum contato/negócio, pedir confirmação explícita no modal avisando que o dado histórico será perdido (usar o padrão de modal destrutivo da Etapa 6)
6. Os 6 campos customizados do seed (`gasto_mensal_cartao`, `gasto_anual_viagens`, `frequencia_viagens_ano`, `perfil_profissional`, `mentalidade`, `economia_estimada`) devem aparecer aqui, já que foram criados no seed da Etapa 2 — essa tela é só a UI de gestão deles, não precisa recriar

### B. Tags (`/admin/tags`)
7. Listar tags existentes (nome + cor)
8. Criar/editar/excluir tag
9. Excluir tag que já está em uso: confirmar (mesma lógica do item 5), removendo a associação em `deal_tags`

### C. Contatos (`/contatos`)
10. Tela de listagem em formato de **tabela** (usar o componente de tabela da Etapa 6: header sticky, sem zebra striping, hover sutil): nome, telefone, email, tags, e colunas dinâmicas pros campos customizados de `entity = 'contato'` mais relevantes (definir 2-3 como padrão visível, resto acessível ao clicar no contato)
11. Busca por nome, telefone ou email (campo de busca no topo da tabela)
12. Criar contato manualmente: modal com nome, telefone, email, campos customizados dinâmicos (renderizados a partir de `custom_field_definitions` — texto vira input, número vira input numérico, select vira dropdown com as opções cadastradas, data vira date picker), e atribuição de tags
13. Editar contato: mesmo formulário, pré-preenchido
14. Página de detalhe do contato (`/contatos/[id]`): dados completos, campos customizados, tags, e — reaproveitando o endpoint já existente da Etapa 5 (`GET /api/conversations/{contactId}/export`) — histórico de conversa e botão "Exportar conversa (.md)" também aqui, não só em `/atendimento`
15. Excluir contato: confirmar via modal; se o contato tiver negócios vinculados, avisar quantos e bloquear a exclusão (mesma lógica de proteção já usada pra etapas na Etapa 4) — orientar a mover/excluir os negócios primeiro

### D. Validações e estados
16. Telefone é campo obrigatório e único (mesma regra de índice único já existente em `contacts.phone` desde a Etapa 2) — mostrar erro de formulário claro se tentar duplicar
17. Empty state quando não houver nenhum contato ainda (usar o padrão da Etapa 6)
18. Loading skeleton na tabela enquanto carrega

## Critérios de aceite
- Admin cria um campo customizado novo (ex: tipo texto) e ele aparece imediatamente no formulário de contato
- Editar as opções de um campo `select` já existente reflete no formulário sem precisar de deploy
- Excluir um campo com dado preenchido pede confirmação explícita antes de apagar
- Os 6 campos do seed aparecem em `/admin/campos` corretamente categorizados
- Criar/editar/excluir tag funciona, incluindo aviso ao excluir tag em uso
- Tabela de contatos carrega, busca por nome/telefone/email funciona
- Criar contato novo com campos customizados preenchidos salva corretamente em `custom_fields` (jsonb)
- Tentar cadastrar dois contatos com o mesmo telefone é bloqueado com mensagem clara
- Página de detalhe do contato mostra histórico de conversa (se houver) e o botão de exportar `.md` funciona ali também
- Excluir contato com negócio vinculado é bloqueado com mensagem explicativa
- Toda a tela usa exclusivamente os tokens/componentes do design system da Etapa 6 — nenhuma cor ou componente ad-hoc

## Fora do escopo desta etapa
Não construa a tela de negócios nem o kanban ainda — isso é a Etapa 8, que depende desta etapa estar pronta (negócio vai referenciar contato, campos customizados e tags já existentes). Não implemente ainda a automação de tarefa por etapa (Etapa 9) nem o motor de webhook (Etapa 10).

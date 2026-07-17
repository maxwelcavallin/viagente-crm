# Prompt — Etapa 30: Central de Ajuda (com screenshots automatizados e acesso via MCP)

## Contexto
Central de ajuda cobrindo toda a plataforma, do primeiro login ao uso avançado. Dois tipos de conteúdo, propositalmente diferentes:
1. **"Primeiros passos"** — narrativa sequencial, em **duas trilhas separadas** (admin e atendente têm jornadas de início bem diferentes)
2. **Central de referência por tópico** — um artigo por funcionalidade, buscável, não-sequencial (pra dúvida pontual de uso)

**Design system obrigatório:** `docs/dia1-etapas/etapa-6-design-system.md`.

**Depende de:** Etapa 28 (API/MCP) já com o modelo de dois escopos — a central de ajuda usa o mesmo servidor MCP, adicionando novas tools.

## Migration necessária
```
help_categories (id, name, slug, "order", icon)

help_articles (id, category_id nullable, title, slug UNIQUE,
               content markdown,                 -- corpo do artigo; screenshots referenciados por {{screenshot:step_key}}
               track ['primeiros_passos_admin','primeiros_passos_atendente','referencia'],
               "order" nullable,                 -- só relevante dentro de uma trilha sequencial
               role_visibility ['todos','admin','atendente'] default 'todos',
               created_at, updated_at)

help_article_screenshots (id, article_id, step_key UNIQUE por artigo,
                           image_url, alt_text, highlighted_element_description,
                           generated_at)
```

## Tarefas

### A. Script de geração automática de screenshots (Playwright)
1. Criar `scripts/generate-help-screenshots.ts` (ou `.js`): sobe/aponta pro app rodando (dev ou staging com dados de exemplo, nunca dados reais de cliente), loga como um usuário admin de teste e um atendente de teste, navega até cada tela relevante
2. Pra cada passo definido (uma lista de `{step_key, url, selector_do_elemento_a_destacar, descricao}`), o script:
   - Navega até a URL
   - Localiza o elemento pelo seletor/`data-testid`
   - Tira o screenshot da tela
   - Desenha um destaque visual sobre o elemento (contorno arredondado ou círculo, na cor `--primary` do design system, com leve espessura) usando as coordenadas do elemento (bounding box do Playwright) — pode usar uma lib de manipulação de imagem (`sharp`, `canvas`) pra desenhar por cima do PNG gerado
   - Salva o resultado no object storage (mesmo R2/S3 já usado) ou em `/public/help-screenshots/`, e grava/atualiza o registro em `help_article_screenshots` (por `step_key`)
3. Script deve ser **re-executável a qualquer momento** (ex: `npm run generate:help-screenshots`) pra atualizar as imagens sempre que a UI mudar — documentar isso no README
4. Adicionar `data-testid` nos elementos-chave da UI que ainda não tiverem (botões principais de cada fluxo), já que o script depende de seletores estáveis, não de texto/posição que muda

### B. Conteúdo — Claude Code escreve o rascunho com base nas specs já existentes
5. Escrever os artigos usando como fonte o conteúdo já detalhado em cada `docs/dia1-etapas/etapa-N-*.md` — o rascunho deve ser revisado por um humano depois, mas já nasce tecnicamente correto (URLs, nomes de campo, comportamento) por vir da própria especificação
6. **Trilha "Primeiros passos — Admin"** (sequencial, `track='primeiros_passos_admin'`): login inicial → convidar usuários (Etapa 3) → criar/ajustar pipeline e etapas (Etapa 4) → cadastrar campos customizados e tags (Etapa 7) → conectar canal WhatsApp (Etapa 5) → configurar tarefas automáticas por etapa e templates (Etapa 9) → conectar Google Agenda (Etapa 12) → visão geral de Configurações (ajuste de consolidação)
7. **Trilha "Primeiros passos — Atendente"** (sequencial, `track='primeiros_passos_atendente'`): primeiro login e troca de senha → navegando o kanban de negócios (Etapa 8) → criando um negócio → atendendo pelo WhatsApp (Etapa 5b: mídia, áudio, emoji, responder, favoritar) → executando uma tarefa (Etapa 9) → recebendo notificações (Etapa 23)
8. **Central de referência** (`track='referencia'`, um artigo por tópico, categorizados): Pipelines e Kanban; Negócios (criar/editar/filtrar); Contatos e campos customizados; Atendimento WhatsApp completo; Instagram Direct; Envio de email por atividade; Automações e sequências inteligentes; Notificações; Histórico do negócio; Google Agenda; Página LinkedIn; Pós-venda e NPS; Webhooks de entrada e saída; Importação de dados da Clint; Configurações gerais; API e MCP
9. Cada artigo de referência segue a mesma estrutura: o que é, passo a passo numerado (com `{{screenshot:step_key}}` nos pontos certos), perguntas frequentes relacionadas ao final

### C. Páginas da central de ajuda
10. `/ajuda`: busca (full-text sobre título e conteúdo), destaque pras duas trilhas de "Primeiros passos" no topo, categorias da central de referência abaixo
11. `/ajuda/primeiros-passos/admin` e `/ajuda/primeiros-passos/atendente`: navegação sequencial (anterior/próximo) entre os artigos da trilha
12. `/ajuda/[categoria]/[slug]`: artigo de referência individual
13. Artigos com `role_visibility` diferente de `todos` não aparecem na navegação/busca pra quem não tem a role — ex: atendente não vê artigos de configuração admin
14. Ícone de ajuda (lucide-react) acessível de qualquer tela do CRM, levando pra `/ajuda`

### D. Acesso via MCP
15. Adicionar ao servidor MCP (Etapa 28) as tools: `buscar_artigos_ajuda(query)`, `obter_artigo_ajuda(slug)`, `listar_categorias_ajuda()` — disponíveis em **qualquer** escopo de API key (operacional ou admin), já que é conteúdo de ajuda, não dado sensível
16. Resposta da tool inclui o texto do artigo; screenshots podem ser referenciados por URL (o agente pode mencionar que existe uma imagem, mas a tool em si retorna texto)

## Critérios de aceite
- Rodar o script de screenshots gera as imagens com destaque visual correto no elemento certo, pros passos definidos
- Rodar o script de novo (depois de uma mudança de UI) atualiza as imagens sem precisar editar o texto dos artigos
- As duas trilhas de "Primeiros passos" existem, cada uma com navegação sequencial anterior/próximo
- Central de referência tem pelo menos um artigo por tópico listado no item B8, com passo a passo tecnicamente correto
- Busca em `/ajuda` encontra artigos por palavra-chave do título ou conteúdo
- Atendente não vê artigos marcados como admin-only
- Um agente conectado via MCP consegue buscar e obter o conteúdo de um artigo de ajuda com sucesso
- Toda a UI nova usa exclusivamente os tokens/componentes do design system da Etapa 6

## Fora do escopo desta etapa
Não implementar vídeo/gravação de tela, só screenshot estático com destaque. Não implementar sistema de feedback "esse artigo ajudou?" nesta etapa inicial. Não traduzir pra outro idioma além de português.

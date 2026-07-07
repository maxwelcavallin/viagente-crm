# Prompt — Etapa 6: Design System + Remodelação da UI (referência Clint + marca Viagente)

## Sumário
1. Conflito de cor resolvido
2. Tokens do Design System (cor, tipografia, ícones, espaçamento, raio)
3. Padrões estruturais da Clint (layout de referência)
4. Padrões de interação do Kanban (drag-and-drop)
5. Componentes complementares (formulário, modal, dropdown, tabela, toast, empty/loading state)
6. Responsividade
7. Escopo desta etapa e critérios de aceite

## Contexto
Etapas 1-5 concluídas (setup, schema, auth, pipelines, WhatsApp). O CRM funciona, mas cada tela foi estilizada ad-hoc com os defaults do shadcn/ui — sem um sistema visual único. Esta etapa cria o **design system oficial e completo do produto** e **remodela todas as telas já construídas** para usá-lo, sem exceção.

**Referência de UX/estrutura:** a Clint (CRM anterior, especializada em vendas via WhatsApp no mercado brasileiro). Use como inspiração de *layout e comportamento* (seções 3 e 4), não de cor — a cor vem da marca Viagente.

**Referência de cor/tipografia:** marca Viagente (dourado sobre fundo escuro premium). Tokens na seção 2 — use exatamente esses valores, não invente variações.

**Referência de usabilidade geral:** princípios consolidados de UX para CRM e dashboards (clareza acima de estética, consistência entre telas, cor nunca como único sinal de estado, feedback imediato em toda ação, acessibilidade por teclado). Essas referências estão integradas em cada seção abaixo, não é preciso pesquisar de novo.

## Regra mais importante desta etapa
**Não pode haver dois padrões visuais coexistindo.** Remover completamente as cores default do shadcn/Tailwind (azul, cinza genérico) de qualquer componente já existente, substituindo por essas variáveis. Cor hardcoded (hex direto no componente em vez de variável de tema) deve ser corrigida. Este documento cobre tokens, os componentes estruturais mais específicos do CRM (kanban, atendimento) E os componentes genéricos de qualquer produto (tabela, modal, dropdown, toast, formulário, estado vazio/loading) — nenhum desses deve ser inventado ad-hoc por não estar aqui.

---

## 1. Conflito de cor resolvido (regra de uso)

A marca Viagente proíbe cores vibrantes (verde/vermelho/teal) fora do dourado. Mas o CRM precisa de cor semântica pra dados (temperatura do lead, status de mensagem, sucesso/erro). A resolução:

- **Dourado (`--primary`) é exclusivo de marca/ação primária:** botões primários, links, foco, itens ativos de navegação, ícones de destaque.
- **Cores semânticas (verde/amarelo/vermelho/azul) são exclusivas de dado pontual:** badge de temperatura, ticks de status de mensagem, alertas de formulário, borda de toast. Regras obrigatórias:
  - Sempre **bolinha (dot) pequena, badge/pill compacto, ou borda fina de 2-3px** — nunca fundo de página, banner grande ou gradiente.
  - **Nunca só a cor sozinha** — sempre com texto ou ícone junto. Isso não é só regra de marca: é acessibilidade real, já que usuários com daltonismo não distinguem status só pela cor.
  - Nunca usadas como cor de botão primário ou de navegação.

---

## 2. Tokens do Design System

Mapear diretamente nas variáveis CSS que o shadcn/ui já usa (`globals.css` ou equivalente do projeto). **Modo claro é o padrão; modo escuro via toggle** (persistir preferência do usuário — pode ser cookie ou localStorage, é aplicação real, não artifact).

### Modo claro (padrão)
```css
:root {
  --background: 40 33% 98%;      /* #FBFAF7 — branco quente, não branco puro */
  --foreground: 0 0% 9%;         /* #171717 — ink quase preto */
  --card: 0 0% 100%;             /* #FFFFFF */
  --card-foreground: 0 0% 9%;
  --popover: 0 0% 100%;
  --popover-foreground: 0 0% 9%;
  --primary: 38 100% 45%;        /* #E59501 — dourado da marca */
  --primary-foreground: 0 0% 9%; /* texto escuro sobre dourado, não branco */
  --secondary: 40 20% 94%;       /* #F1EEE7 — neutro quente claro */
  --secondary-foreground: 0 0% 9%;
  --muted: 40 20% 94%;
  --muted-foreground: 0 0% 42%;  /* #6B6B6B */
  --accent: 38 100% 45% / 0.12;  /* dourado 12% opacidade — hover/seleção sutil */
  --accent-foreground: 33 96% 40%; /* #CB8401 — dourado médio, pra texto sobre accent */
  --destructive: 0 72% 51%;      /* #DC2626 */
  --destructive-foreground: 0 0% 100%;
  --border: 40 15% 88%;          /* #E8E4DC */
  --input: 40 15% 88%;
  --ring: 38 100% 45%;
  --radius: 0.75rem;             /* 12px — cards */
}
```

### Modo escuro (toggle)
```css
.dark {
  --background: 0 0% 7%;         /* #111111 */
  --foreground: 40 30% 92%;      /* #F2EDE3 — branco quente */
  --card: 0 0% 11%;              /* #1C1C1C */
  --card-foreground: 40 30% 92%;
  --popover: 0 0% 11%;
  --popover-foreground: 40 30% 92%;
  --primary: 38 100% 45%;        /* #E59501 — mesmo dourado */
  --primary-foreground: 0 0% 7%; /* texto escuro sobre dourado, mesmo no dark */
  --secondary: 0 0% 9%;          /* #171717 */
  --secondary-foreground: 40 30% 92%;
  --muted: 0 0% 9%;
  --muted-foreground: 32 8% 60%; /* #A09A8E */
  --accent: 38 100% 45% / 0.12;
  --accent-foreground: 33 96% 40%;
  --destructive: 0 84% 63%;      /* #EF4444 — mais claro pra contraste no dark */
  --destructive-foreground: 0 0% 9%;
  --border: 0 0% 16%;            /* #2A2A2A */
  --input: 0 0% 16%;
  --ring: 38 100% 45%;
}
```

### Cores semânticas (adicionais, fora da convenção shadcn — criar como variáveis próprias)
```css
:root {
  --status-success: #16A34A;   /* verde — lead quente, sucesso, mensagem lida */
  --status-warning: #D97706;   /* amber — lead morno, atenção */
  --status-danger:  #DC2626;   /* vermelho — lead frio, erro, falha de envio */
  --status-info:    #2563EB;   /* azul — informativo, ex: tick de "lido" no estilo WhatsApp */
}
.dark {
  --status-success: #22C55E;
  --status-warning: #F59E0B;
  --status-danger:  #EF4444;
  --status-info:    #3B82F6;
}
```

### Tipografia
- Fonte única: **Inter** (`https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap`)
- Escala:
  - Título de página: 700, 24-28px
  - Título de seção/card: 600, 16-18px
  - Corpo: 400, 14px
  - Label/eyebrow (ex: nome de coluna do kanban, label de campo): 500, 11px, uppercase, letter-spacing 0.08em
  - Botões: 600, 14px
  - Números de destaque pontual: pode usar gradiente dourado (`linear-gradient(135deg, #E59501, #CB8401, #986300)` com `background-clip: text`), mas só 1 por tela

### Ícones
- Biblioteca: **lucide-react** (já disponível no ecossistema shadcn/ui, não introduzir uma segunda biblioteca)
- Tamanho padrão: 16px em botões/badges/inline; 20px em itens de navegação; 40-48px em empty states (sempre `opacity: 0.4`, cor `--muted-foreground`)
- `stroke-width`: 1.75

### Espaçamento e grid
- Escala base: 4px (escala padrão do Tailwind, sem customização)
- Container principal: max-width 1280px, padding lateral 16px mobile / 24px tablet / 32px desktop
- Sidebar: 240px em telas grandes (`lg` e acima)
- Top nav / header: altura 56-64px
- Espaçamento interno de card: 20-24px

### Raio de borda e elevação
- Cards, painéis, modais: **12px**
- Botões, inputs, badges retangulares, toasts: **8px**
- Avatares, pills de status, badge de contagem: **999px (full round)**
- **Zero box-shadow, zero blur, zero glow.** Profundidade vem só de contraste de borda e mudança de cor de borda no hover. Exceção única: overlay de modal usa `rgba(0,0,0,.4)` — é scrim de camada, não sombra do elemento. (Essa disciplina visual também é boa prática de dashboard: excesso de gradiente, glassmorphism e animação tende a poluir a leitura de dados, não só quebrar a identidade da marca.)

---

## 3. Padrões estruturais da Clint (referência de layout, não de cor)

**Navegação:**
- Barra superior com abas (Início, Negócios, Contatos, Atividades, Atendimento com badge de contagem, Automações, Indicadores, Mais) — `--border` como divisor, aba ativa com `--primary` como underline ou texto, nunca fundo colorido cheio
- Sidebar esquerda com grupos colapsáveis (ex: "Origens", "Visualizações", "Recentes"), item ativo com fundo `--accent` e texto `--accent-foreground`

**Kanban de pipeline:**
- Cada coluna = uma etapa, header mostra nome da etapa + contador de negócios + soma de valor (R$)
- Card do negócio: nome do contato + empresa/tag, avatar redondo, preview da última mensagem do WhatsApp com ícone do canal, ícones de ação rápida (WhatsApp, ligar, adicionar, email), indicador de tempo na etapa (ex: "27m", "7d")
- Card usa `--card` de fundo, `--border`, `--radius: 12px`; hover muda `border-color` pra tom dourado suave, sem sombra
- Comportamento de arraste: ver seção 4

**Painel de atendimento (conversa):**
- Header: nome do contato, ícone de canal WhatsApp, avatar, ícones de ação (agendar, tarefas, menu)
- Bolhas de mensagem: recebida usa `--secondary`/`--muted`; enviada usa `--accent` (dourado 12%) com texto `--foreground` — nunca `--primary` sólido como fundo de bolha
- Ticks de status: cinza (enviado) → cinza duplo (entregue) → `--status-info` azul (lido)
- Input de mensagem: barra inferior fixa com ícones de anexo/emoji/template + botão de enviar em `--primary`

**Badge de temperatura do lead:**
- Pill (999px) com bolinha de cor (`--status-success`/`--status-warning`/`--status-danger`) + texto ("Quente"/"Morno"/"Frio")

---

## 4. Padrões de interação do Kanban (drag-and-drop)

Arrastar um card entre etapas é a ação mais frequente do produto — a experiência dessa interação importa tanto quanto a cor. Regras obrigatórias:

- **Affordance de arraste:** cursor muda para `grab` ao passar sobre o card e `grabbing` ao segurar. Ao ser pego, o card recebe leve `scale(1.02)` e a `border-color` muda pra tom dourado — nunca usar sombra pra indicar "elevação" (mantém a regra de zero-shadow)
- **Zona de destino válida:** a coluna sob o cursor durante o arraste ganha uma borda tracejada em `--primary`, para deixar claro onde o card vai cair
- **Zona de destino inválida** (se uma regra de negócio bloquear o movimento): indicador visualmente diferente do válido — ex: borda em `--status-danger` — nunca o mesmo estilo do válido, senão o usuário não sabe se pode soltar ali
- **Feedback imediato:** ao soltar, o contador e a soma de valor (R$) das colunas de origem e destino atualizam instantaneamente, sem reload da página
- **Gate de campo obrigatório:** se a etapa de destino tiver `stage_tasks` que dependam de dado ainda não preenchido no negócio, abrir um modal pedindo essa informação antes de confirmar o movimento — nunca mover "no escuro" e falhar silenciosamente depois
- **Desfazer:** toast de confirmação com opção "Desfazer" por ~5 segundos após mover um card
- **Acessibilidade por teclado:** Tab foca o card; Espaço/Enter "pega"; setas navegam entre colunas enquanto o card está selecionado; Espaço/Enter solta; Esc cancela e devolve o card à coluna original
- **Mobile:** arrastar é difícil em tela pequena — oferecer alternativa via menu de contexto no card ("Mover para...") com lista de etapas, em vez de forçar o gesto de arrastar no toque

---

## 5. Componentes complementares (obrigatórios — sem isso o design system não está completo)

Estes componentes vão aparecer em praticamente toda tela futura do CRM (incluindo a próxima etapa, lista de contatos/negócios). Definir agora evita que cada etapa futura invente um padrão novo.

**Formulário (inputs, select, textarea):**
- Altura padrão: 40px. Raio 8px. Fundo `--background`, borda `--input`
- Foco: borda muda pra `--ring` (dourado) + contorno sólido de 2px em `--ring` a 20% de opacidade, deslocado 1-2px pra fora — contorno nítido, não glow desfocado
- Erro: borda `--destructive`, texto de ajuda abaixo em `--destructive` com ícone de alerta
- Desabilitado: opacity 50%, cursor not-allowed, fundo `--muted`
- Label acima do campo: estilo eyebrow (500, 12px)

**Modal / diálogo:**
- Overlay: `rgba(0,0,0,.4)` atrás do painel, em qualquer tema
- Painel: fundo `--card`, borda `--border`, raio 12px, sem sombra própria
- Header: título 600/18px + botão de fechar (X) no canto superior direito
- Footer: ações à direita — secundária (ex: "Cancelar") em outline/ghost, primária em `--primary` preenchido; destrutiva (ex: "Excluir etapa") em `--destructive` preenchido
- Largura: 480px pra confirmações simples, até 640px pra modais com formulário

**Dropdown / select / menu de contexto:**
- Gatilho: mesma altura/estilo de um input (40px, 8px de raio)
- Painel: fundo `--popover`, borda `--border`, raio 8px, 4px de distância do gatilho
- Itens: padding 8px 12px, hover/foco com fundo `--accent`
- Item selecionado: ícone de check + texto em `--accent-foreground` (não preencher o item inteiro de dourado)

**Tabela de dados** (necessária já na próxima etapa — lista de contatos/negócios):
- Header: fundo `--secondary`/`--muted`, texto `--muted-foreground`, 500/12px uppercase, sticky ao rolar
- Linhas: sem zebra striping — separação só por `border-bottom` em `--border`
- Hover de linha: fundo `--accent`
- Padding de célula: 12px 16px; altura de linha 48px desktop, 56px em telas touch

**Toast / notificação:**
- Posição: canto superior direito desktop, topo central mobile
- Fundo `--card`, borda `--border`, raio 12px, borda esquerda de destaque 3px na cor semântica conforme o tipo
- Ícone + texto, auto-dismiss em ~4s (exceto o toast de "Desfazer" do kanban, que dura ~5s)

**Empty state:**
- Ícone centralizado (lucide-react, 40-48px, `opacity: 0.4`, `--muted-foreground`)
- Título 600/16px + texto de apoio 400/14px em `--muted-foreground`
- Ação primária opcional abaixo
- Usado em: coluna de kanban sem negócios, lista de atendimento vazia, listagens de admin vazias

**Loading / skeleton:**
- Blocos com fundo `--muted` e pulso de opacidade (0.5 ↔ 1) — nunca shimmer ou glow
- Raio igual ao elemento representado (linha de texto: 4px; card: 12px)
- Spinner: anel simples em `--primary`, mantendo a largura do botão

---

## 6. Responsividade (obrigatória desde esta etapa)

O CRM precisa funcionar bem tanto em desktop quanto em celular. Breakpoints padrão do Tailwind (`sm` 640px, `md` 768px, `lg` 1024px, `xl` 1280px).

- **Sidebar:** fixa (240px) em `lg`+; abaixo disso vira drawer off-canvas acionado por hambúrguer
- **Top nav:** abas que não couberem colapsam pra dentro do menu "Mais"
- **Kanban:** rolagem horizontal com snap por coluna abaixo de `lg`; coluna ocupa ~85% da largura no mobile; drag-and-drop dá lugar ao menu "Mover para..." (ver seção 4)
- **Atendimento:** split-pane em `lg`+; abaixo disso, navegação de duas telas (lista ↔ conversa em tela cheia, com botão "voltar"), no padrão do WhatsApp mobile
- **Tabelas de admin:** rolagem horizontal em wrapper `overflow-x: auto` em telas pequenas
- **Alvos de toque:** altura mínima 40px em qualquer elemento clicável abaixo de `md`

---

## 7. Escopo desta etapa: remodelar TUDO que já existe

Aplicar os tokens e padrões acima nas telas já construídas nas Etapas 1-5, sem exceção:
1. `/login`
2. `/admin/usuarios`
3. `/admin/pipelines` e `/admin/pipelines/[id]`
4. `/admin/whatsapp` (config de canais + gestão de acesso)
5. `/atendimento` (inbox + conversa)
6. Componentes compartilhados: botões, inputs, tabelas, badges, avatares, sidebar, top nav, modais, dropdowns, toasts, empty/loading states, kanban

Adicionar:
7. Toggle de tema (claro/escuro), preferência persistida
8. Arquivo central de tokens como fonte única de verdade — nenhum componente com cor hardcoded
9. Comportamento responsivo (seção 6) em todas as 5 telas
10. Comportamento de drag-and-drop do kanban (seção 4), incluindo acessibilidade por teclado e alternativa mobile

## Critérios de aceite
- Todas as 5 telas usam exclusivamente as variáveis de tema (zero hex/rgb hardcoded fora do arquivo central)
- Toggle claro/escuro funciona sem reload e persiste ao recarregar
- Modo claro é o padrão sem preferência salva
- Badge de temperatura mostra bolinha de cor + texto, nunca só a cor
- Bolha de mensagem enviada usa `--accent`, não `--primary` sólido
- Nenhum componente usa box-shadow, blur ou glow (exceto scrim de modal)
- Cards 12px de raio; botões/inputs 8px; avatares/pills 999px
- Arrastar um card no kanban mostra affordance de arraste, zona de destino clara, atualiza contadores instantaneamente, e oferece desfazer
- Mover card via teclado funciona (Tab, Espaço/Enter, setas, Esc)
- No mobile, o kanban oferece "Mover para..." como alternativa ao arraste
- Formulários mostram foco, erro e desabilitado conforme especificado
- Modal de confirmação segue o padrão de header/footer descrito
- Toast de sucesso/erro aparece com a borda semântica correta
- Abaixo de `lg`: sidebar vira drawer, `/atendimento` vira navegação de duas telas
- Trocar de tema não quebra nenhuma tela, em nenhum breakpoint (testar as 5 em ambos os modos, desktop e mobile)

## Fora do escopo desta etapa
Não adicionar novas funcionalidades — é só remodelação visual e de interação do que já existe. Não mexer no schema do banco. Não implementar dashboards ou indicadores (isso é Fase 2).

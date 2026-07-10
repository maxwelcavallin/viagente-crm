# Ajuste — Consolidar Configurações numa Aba Única

## Contexto
Hoje as telas de administração estão espalhadas em rotas soltas: `/admin/usuarios`, `/admin/pipelines`, `/admin/whatsapp`, e o que mais tiver sido criado (campos customizados, tags, templates da Etapa 9). Isso não escala bem e não corresponde ao padrão esperado de um CRM — tudo que é configuração de implantação da plataforma deve morar dentro de uma única aba **"Configurações"**, com sub-navegação interna.

**Design system obrigatório:** use os tokens/componentes de `docs/dia1-etapas/etapa-6-design-system.md` — a sub-navegação de configurações deve seguir o mesmo padrão visual da sidebar já definida (item ativo com fundo `--accent`).

## Objetivo desta etapa
Mover todas as telas de administração pra dentro de uma rota única `/configuracoes`, com sub-navegação lateral (ou em abas, o que for mais natural dado o volume de itens) listando cada área de configuração.

## Tarefas
1. Criar a rota `/configuracoes` com um layout próprio: sub-navegação lateral listando todas as áreas de configuração existentes até agora:
   - Usuários (antes `/admin/usuarios`)
   - Pipelines e Etapas (antes `/admin/pipelines`)
   - Campos Customizados (antes `/admin/campos`, da Etapa 7)
   - Tags (antes `/admin/tags`, da Etapa 7)
   - WhatsApp — Canais e Acesso (antes `/admin/whatsapp`, da Etapa 5)
   - Templates de Mensagem (antes `/admin/templates`, da Etapa 9)
   - Webhooks (se a Etapa 10 já tiver sido feita — `/admin/webhooks`)
2. Mover o conteúdo de cada rota antiga pra dentro de `/configuracoes/[area]` correspondente, preservando toda a lógica e permissões já implementadas (nada de reescrever a funcionalidade, só a localização/rota)
3. Atualizar toda a navegação principal (top nav / sidebar) removendo os links soltos de admin e adicionando **um único item "Configurações"** (ícone de engrenagem) que leva pra essa área
4. Manter o controle de acesso: `/configuracoes` inteira continua acessível só por `role = admin` — se algum atendente tentar acessar, mesmo comportamento de bloqueio já usado nas telas antigas
5. Configurar redirects das rotas antigas (`/admin/*`) pras novas (`/configuracoes/*`), caso haja links salvos ou bookmarks — evita quebrar acesso direto por URL

## Critérios de aceite
- `/configuracoes` existe e lista todas as áreas de configuração numa sub-navegação consistente com o design system
- Cada área (Usuários, Pipelines, Campos, Tags, WhatsApp, Templates, Webhooks) funciona exatamente como antes, só que dentro da nova rota
- A navegação principal mostra um único item "Configurações", não mais links soltos de admin
- Acessar uma rota antiga (`/admin/usuarios`, por exemplo) redireciona pra `/configuracoes/usuarios` sem quebrar
- `atendente` continua sem acesso a `/configuracoes` (nem a nenhuma sub-rota dela)

## Fora do escopo desta etapa
Não mude a lógica interna de nenhuma tela — é só reorganização de rota/navegação. Não adicione nenhuma configuração nova que ainda não exista.

# Prompt — Etapa 1: Setup & Infraestrutura (Dia 1, CRM Viagente)

## Contexto
Estamos construindo o CRM da Viagente para substituir a Clint. A especificação completa está em `viagente-crm-spec.md` — leia esse arquivo inteiro antes de começar, ele tem o modelo de dados completo, o motor de webhook, a integração Z-API e o plano de execução dos 7 dias. Esta é a **Etapa 1 do Dia 1**.

## Decisão de stack (adote, salvo problema técnico real — se decidir mudar algo, explique o motivo antes)
- Next.js (App Router) + TypeScript
- Drizzle ORM
- Banco: Neon (Postgres serverless)
- Deploy: Vercel
- UI: Tailwind CSS + shadcn/ui
- Gerenciador de pacotes: npm

## Objetivo desta etapa
Deixar o projeto rodando localmente e em produção (Vercel), conectado a um banco Neon, pronto para receber as migrations da Etapa 2. **Não crie tabelas de negócio nem autenticação ainda** — isso é escopo das próximas etapas.

## Tarefas
1. Inicializar projeto Next.js + TypeScript com Tailwind e shadcn/ui configurados
2. Configurar Drizzle ORM apontando para um banco Neon:
   - Se o banco ainda não existe, crie-o (plano Launch)
   - Configurar autoscaling com teto baixo (1-2 CU) e scale-to-zero ativado — isso é importante para custo, está detalhado na seção 4 da especificação
3. Criar `.env.example` documentando todas as variáveis de ambiente necessárias (no mínimo `DATABASE_URL`)
4. Criar endpoint `GET /api/health` que executa um `SELECT 1` no banco via Drizzle e retorna `{ status: "ok", db: "connected" }` (ou erro claro se a conexão falhar)
5. Fazer o deploy inicial no Vercel e validar que `/api/health` responde 200 em produção
6. Escrever um `README.md` com passo a passo de setup local: instalar dependências, configurar `.env`, rodar `npm run dev`

## Critérios de aceite (vou validar com um plano de testes separado)
- `npm run dev` sobe o projeto localmente sem erro
- `/api/health` retorna 200 tanto local quanto em produção, confirmando conexão real com o Neon
- `.env.example` existe e cobre todas as variáveis usadas no projeto
- Qualquer pessoa da equipe consegue rodar o projeto do zero só seguindo o README

## Fora do escopo desta etapa
Não crie tabelas de negócio (contatos, negócios, pipelines etc. — isso é a Etapa 2). Não implemente login/autenticação (Etapa 3). Não crie nenhuma tela além de uma home mínima, se necessário.

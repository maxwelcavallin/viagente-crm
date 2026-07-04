# CRM Viagente

CRM interno da Viagente (substituto da Clint). Ver a especificação completa em `viagente-crm-spec.md`.

**Stack:** Next.js (App Router) + TypeScript + Tailwind CSS + shadcn/ui + Drizzle ORM + Neon (Postgres serverless), deploy na Vercel.

## Setup local

### 1. Instalar dependências

```bash
npm install
```

### 2. Configurar variáveis de ambiente

Copie `.env.example` para `.env.local` e preencha com a connection string do banco Neon:

```bash
cp .env.example .env.local
```

Se o projeto já estiver linkado à Vercel (integração Neon instalada), você pode puxar as variáveis direto:

```bash
npx vercel link
npx vercel env pull .env.local
```

### 3. Rodar as migrations e o seed

```bash
npm run db:migrate
npm run db:seed
```

O seed é idempotente: rodar de novo não duplica a pipeline, as etapas, os campos customizados nem as regras de temperatura (ele checa existência por nome/chave antes de inserir e pula o que já existe).

### 4. Rodar o projeto

```bash
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000). Para conferir a conexão com o banco, acesse [http://localhost:3000/api/health](http://localhost:3000/api/health) — deve retornar `{ "status": "ok", "db": "connected" }`.

### 5. Criar o primeiro usuário admin e logar

Em um ambiente novo (banco recém migrado/seedado) ainda não existe nenhum usuário — sem isso não dá pra logar. Crie o primeiro admin com:

```bash
npm run create-admin -- "Seu Nome" "seu@email.com"
```

O script imprime a senha temporária **uma única vez** no terminal — copie e use pra logar em `/login`. No primeiro login o sistema força a troca dessa senha antes de liberar o resto do sistema. Rodar o script de novo com o mesmo email não duplica nem sobrescreve nada (é seguro rodar mais de uma vez, só que só cria se o email ainda não existir).

Depois disso, o próprio admin pode criar os demais usuários pela tela `/admin/usuarios` (mesma lógica de senha temporária exibida uma vez).

## Autenticação (Auth.js / NextAuth v5)

- Login por email + senha (`Credentials` provider), sessão em JWT — ver `src/auth.ts`.
- Proteção de rota em `src/proxy.ts` — no Next.js 16 o arquivo `middleware.ts` foi renomeado para `proxy.ts` (mesma função, nome do export mudou de `middleware` para `proxy`/default export). Toda a lógica de autorização (redirecionar não autenticado pra `/login`, forçar `/trocar-senha`, bloquear `/admin/*` pra quem não é admin) está no callback `callbacks.authorized` em `src/auth.ts`.
- Senhas com hash via `bcryptjs` (mesmo algoritmo/formato do `bcrypt` nativo — trocado só pra evitar risco de falha de compilação nativa no `npm install` em Windows/Node novo).
- `must_change_password`: `true` por padrão em usuários novos; ao trocar a senha em `/trocar-senha`, vira `false` no banco e a action já faz `signOut` forçando novo login (mais simples e confiável do que atualizar o JWT em memória via `useSession().update()`, que se mostrou instável nesse setup Next 16 + NextAuth v5 beta durante os testes — chegou a travar).
- Roles: `admin` (acessa `/admin/*`) e `atendente` (não vê o link nem consegue acessar, é redirecionado pra `/acesso-negado`).
- Não há recuperação de senha por email nesta etapa — se alguém esquecer a senha, um admin cria de novo o acesso manualmente (reset por admin fica pra depois).

**Testado ponta a ponta** (login, troca de senha obrigatória no primeiro acesso, criação de usuário via `/admin/usuarios`, bloqueio de `/admin/*` para `atendente`, logout com invalidação real de sessão) via `npm run dev`. **Pendente**: validar `npm run build` — o disco local ficou sem espaço durante os testes (não é um problema do código) e o build de produção não foi reexecutado depois das últimas alterações no fluxo de troca de senha. Rodar `npm run build` antes de considerar isso testado em produção.

## Banco de dados (Drizzle + Neon)

- Schema em `src/db/schema.ts` (17 tabelas: as 15 do MVP original + `whatsapp_channels` e `whatsapp_channel_restrictions`, ver seção 5 da spec), cliente de conexão em `src/db/index.ts`.
- `npm run db:generate` — gera migrations a partir do schema.
- `npm run db:migrate` — aplica migrations pendentes no banco.
- `npm run db:seed` — popula a pipeline "Funil Viagente" (7 etapas), os 6 campos customizados e as 3 regras de temperatura padrão (`scripts/seed.ts`).
- `npm run db:studio` — abre o Drizzle Studio para inspecionar o banco.

### Particionamento de `messages`

A tabela `messages` é particionada por mês (`created_at`) via SQL raw editado manualmente na migration `drizzle/0000_schema_completo_mvp.sql` (drizzle-kit não gera `PARTITION BY` a partir do schema). As partições cobrem 2026-07 a 2026-09, mais uma partição `DEFAULT` como rede de segurança. Antes de 2026-10, criar a próxima partição mensal manualmente (ou via job agendado) para manter o benefício de performance do particionamento — ver comentário no topo da migration.

## Deploy

O projeto está linkado ao time `cavallin` na Vercel (projeto `viagente-crm`), com o banco Neon conectado via integração do Marketplace (variáveis de ambiente já configuradas em Production/Preview/Development).

```bash
npx vercel deploy --prod
```

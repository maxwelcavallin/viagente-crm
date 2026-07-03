# CRM Viagente

CRM interno da Viagente (substituto da Clint). Ver a especificação completa em `../viagente-crm-spec.md`.

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

## Banco de dados (Drizzle + Neon)

- Schema em `src/db/schema.ts` (15 tabelas do MVP, ver seção 5 da spec), cliente de conexão em `src/db/index.ts`.
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

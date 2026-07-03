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

### 3. Rodar o projeto

```bash
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000). Para conferir a conexão com o banco, acesse [http://localhost:3000/api/health](http://localhost:3000/api/health) — deve retornar `{ "status": "ok", "db": "connected" }`.

## Banco de dados (Drizzle + Neon)

- Schema em `src/db/schema.ts`, cliente de conexão em `src/db/index.ts`.
- `npm run db:generate` — gera migrations a partir do schema.
- `npm run db:migrate` — aplica migrations pendentes no banco.
- `npm run db:studio` — abre o Drizzle Studio para inspecionar o banco.

## Deploy

O projeto está linkado ao time `cavallin` na Vercel (projeto `viagente-crm`), com o banco Neon conectado via integração do Marketplace (variáveis de ambiente já configuradas em Production/Preview/Development).

```bash
npx vercel deploy --prod
```

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

## Atendimento via WhatsApp (Z-API)

- Cada número WhatsApp conectado é um **canal** (`whatsapp_channels`), configurado direto na tela `/admin/whatsapp` — não em variável de ambiente. O sistema suporta múltiplos canais simultâneos (ex: comercial + suporte).
- `zapi_token` e `zapi_client_token` são criptografados (AES-256-GCM) antes de gravar no banco, usando `CREDENTIALS_ENCRYPTION_KEY`. Depois de salvos, aparecem mascarados na tela (`••••••1234`).

### 1. Adicionar um canal

Em `/admin/whatsapp` (só `role = admin`), clique em "Adicionar canal" e informe:

- **Nome do canal** (label livre, ex: "Comercial")
- **Z-API Instance ID** e **Token** — da instância específica (painel Z-API → sua instância)
- **Z-API Client-Token** — o "Account Security Token" da conta (painel Z-API → Segurança → Token de Conta), o mesmo para todas as instâncias da conta

Depois de salvo, clique em **"Testar conexão"** pra confirmar que a instância está conectada ao WhatsApp. Marque um canal como **"Tornar padrão"** — é o canal sugerido ao responder um contato que ainda não tem conversa em nenhum canal permitido.

### 2. Gerenciar acesso por atendente

Dentro de cada canal (`/admin/whatsapp/[id]`), a lista de usuários `atendente` aparece com um toggle "tem acesso" — **marcado por padrão** (todo atendente vê todos os canais). Desmarcar bloqueia aquele atendente especificamente daquele canal (fica registrado em `whatsapp_channel_restrictions`). Usuários `admin` não aparecem na lista porque sempre têm acesso a tudo.

### 3. Configurar o webhook na Z-API

Cada canal tem sua própria URL de webhook:

```
https://<seu-dominio>/api/whatsapp/webhook/<channelId>
```

O `channelId` é o `id` do canal (visível na URL de `/admin/whatsapp/[id]`). Configure essa URL no painel da Z-API, na aba **Webhooks** daquela instância, tanto para "Ao receber" (mensagens) quanto para "Status da mensagem" (entregue/lido) — a Z-API envia os dois tipos de evento para a mesma URL, e o endpoint diferencia pelo formato do payload.

**Testando localmente com ngrok:** como a Z-API precisa alcançar sua máquina publicamente, rode um túnel:

```bash
npx ngrok http 3000
```

Use a URL HTTPS gerada pelo ngrok (ex: `https://abcd1234.ngrok-free.app/api/whatsapp/webhook/<channelId>`) no painel da Z-API enquanto testa. Troque para a URL de produção (`https://<seu-dominio-vercel>/...`) antes do cutover final.

⚠️ **Recomendação da spec:** configure primeiro um canal apontando pra uma instância de teste (número que não seja o de produção da Viagente) antes de testar o fluxo — evita risco de mandar mensagem pra um lead real durante os testes.

### 4. Armazenamento de mídia (Cloudflare R2)

Mídia recebida (imagem, áudio, vídeo, documento) é baixada do link temporário da Z-API e enviada para um bucket R2 — nunca fica dependente do link da Z-API, que expira. O bucket tem uma **lifecycle rule**: objetos no prefixo `media/` (imagem, vídeo, documento) expiram em 120 dias; objetos no prefixo `audio/` nunca expiram. Um cron diário (`/api/cron/cleanup-media`, agendado em `vercel.json`) zera o `media_url` no banco das mensagens cuja mídia já expirou, evitando link morto.

O acesso à mídia sempre passa por `/api/media/[messageId]` (nunca uma URL pública direta do R2) — essa rota confere se o usuário logado tem acesso ao canal da mensagem antes de gerar uma URL assinada de curta duração.

## Deploy

O projeto está linkado ao time `cavallin` na Vercel (projeto `viagente-crm`), com o banco Neon conectado via integração do Marketplace (variáveis de ambiente já configuradas em Production/Preview/Development).

```bash
npx vercel deploy --prod
```

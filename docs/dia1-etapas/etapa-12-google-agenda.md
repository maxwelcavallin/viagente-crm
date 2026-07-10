# Prompt — Etapa 12: Integração com Google Agenda (OAuth real, app Interno do Workspace)

## Contexto
A Viagente usa Google Workspace (domínio próprio) — isso muda a abordagem desta etapa. Em vez do link "Adicionar ao Google Agenda" (que não confirma se o evento foi salvo), dá pra ter uma integração OAuth de verdade **sem passar pela revisão do Google**, porque o app pode ser marcado como **"Interno"** — restrito a contas `@viagente.com.br`. Isso significa: zero tela de aviso "app não verificado", zero limite de usuários, e o token **não expira em 7 dias** (diferente do modo "Teste", que teria essa limitação se a Viagente usasse Gmail comum).

## ⚠️ Parte 1 — Configuração manual no Google Cloud (você faz, não o Claude Code)

Isso exige um login real no Google com uma conta admin do Workspace da Viagente — não dá pra automatizar via código. Passo a passo:

1. Acesse [console.cloud.google.com](https://console.cloud.google.com) logado com uma conta `@viagente.com.br`
2. Crie um projeto novo (ex: "Viagente CRM")
3. Vá em **APIs e Serviços → Biblioteca**, busque "Google Calendar API" e clique em **Ativar**
4. Vá em **APIs e Serviços → Tela de consentimento OAuth (OAuth consent screen / "Google Auth Platform")**:
   - **Tipo de usuário: Interno** (é essa escolha que elimina verificação, aviso e expiração — só aparece essa opção porque o projeto pertence a uma organização Workspace)
   - Preencha nome do app, email de suporte, email de contato do desenvolvedor
5. Vá em **Credenciais → Criar credenciais → ID do cliente OAuth**:
   - Tipo de aplicativo: **Aplicativo da Web**
   - URI de redirecionamento autorizado: `https://SEU-DOMINIO/api/auth/google/callback` (e também `http://localhost:3000/api/auth/google/callback` pra testar em dev)
6. Copie o **Client ID** e o **Client Secret** gerados — eles vão virar variáveis de ambiente na Parte 2

## Parte 2 — Prompt pro Claude Code

### Contexto
Etapas 1-11 concluídas. A Parte 1 acima já foi feita manualmente e você tem em mãos: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, e a URI de redirecionamento configurada.

**Design system obrigatório:** `docs/dia1-etapas/etapa-6-design-system.md`.

### Variáveis de ambiente novas
```
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_OAUTH_REDIRECT_URI=https://SEU-DOMINIO/api/auth/google/callback
```
Adicionar ao `.env.example`.

### Migration necessária (schema)
```
google_calendar_connections (
  id,
  user_id,              -- FK users, um por usuário do CRM
  refresh_token,         -- criptografado em repouso, mesma chave já usada pra Z-API (CREDENTIALS_ENCRYPTION_KEY)
  access_token,          -- criptografado, de curta duração
  token_expiry,          -- timestamp de quando o access_token expira
  calendar_id default 'primary',
  connected_at,
  UNIQUE(user_id)
)
```

### Tarefas

#### A. Fluxo de conexão (cada atendente conecta a própria conta Google)
1. Em `/configuracoes` (ou no perfil do próprio usuário), botão **"Conectar Google Agenda"**
2. Ao clicar, redirecionar pro fluxo OAuth do Google solicitando o escopo `https://www.googleapis.com/auth/calendar.events` com `access_type=offline` e `prompt=consent` (garante que o `refresh_token` seja retornado mesmo em reconexões)
3. Endpoint de callback (`/api/auth/google/callback`): troca o `code` pelo `access_token`/`refresh_token`, criptografa e salva em `google_calendar_connections` vinculado ao usuário logado
4. Tela mostra status "Conectado" com a data da conexão, e botão "Desconectar" (remove o registro)

#### B. Criação de evento via API (substituindo o link)
5. Função utilitária que, dado um `user_id`, recupera o `refresh_token`, descriptografa, e obtém um `access_token` válido (renovando via API do Google se o `token_expiry` já passou)
6. Endpoint `POST /api/calendar/events` que recebe título, data/hora início, data/hora fim, descrição (incluindo link de volta pro negócio no CRM), e email do contato (se houver, pra convidar automaticamente) — chama `events.insert` da Google Calendar API com as credenciais do usuário logado
7. Resposta da API (evento criado de verdade) retorna o `htmlLink` (link pra abrir o evento no Google Agenda) e o `id` do evento — **isso é uma vantagem real sobre o link antigo: agora dá pra confirmar que o evento existe de verdade**
8. Guardar o `google_event_id` retornado na `task` correspondente (adicionar coluna `google_event_id` nullable em `tasks`, se ainda não existir), pra permitir editar/cancelar o evento depois se necessário

#### C. Uso nas tarefas e no detalhe do negócio
9. Ao executar uma tarefa tipo `agendamento` (Etapa 9), abrir o mesmo modal de agendamento já existente (título, data/hora, duração, observação) e, ao confirmar, chamar o endpoint da Parte B em vez de montar o link manual
10. Marcar a tarefa como concluída **só depois da resposta de sucesso da API** (diferente do link, que marcava ao clicar — agora temos confirmação real)
11. Botão "Agendar reunião" avulso no detalhe do negócio (Etapa 8) usa o mesmo fluxo

#### D. Fallback (importante — não deixar o usuário travado)
12. **Se o usuário logado ainda não conectou o Google Agenda**, ao tentar agendar, mostrar um aviso claro ("Conecte seu Google Agenda em Configurações pra agendar direto por aqui") com um botão de atalho pra `/configuracoes`, e oferecer como alternativa o link simples "Adicionar ao Google Agenda" (a mesma lógica de URL da versão anterior desta etapa) — assim ninguém fica bloqueado enquanto não conecta a conta

#### E. Tratamento de erro
13. Se a chamada à API do Google falhar (token revogado, permissão retirada, etc.), mostrar toast de erro claro (padrão `--status-danger` da Etapa 6) e sugerir reconectar a conta em `/configuracoes` — nunca falhar silenciosamente

## Critérios de aceite
- Atendente consegue conectar a própria conta Google (`@viagente.com.br`) sem ver nenhuma tela de "app não verificado"
- Criar um agendamento a partir de uma tarefa tipo `agendamento` cria um evento de verdade no Google Agenda do usuário conectado
- O evento criado tem título, horário (fuso correto), descrição com link de volta pro negócio, e convida o contato automaticamente se ele tiver email
- Tarefa só é marcada como concluída depois da confirmação real da API (não antes)
- Usuário sem conta conectada consegue usar o fallback de link simples, sem ficar travado
- Reconectar/desconectar a conta funciona em `/configuracoes`
- Erros da API do Google mostram toast claro, nunca falham silenciosamente
- Nenhuma verificação do Google foi necessária em nenhum momento (app configurado como Interno)

## Fora do escopo desta etapa
Não implementar leitura de disponibilidade/agenda existente do usuário (só criação de evento). Não implementar edição/cancelamento de evento já criado a partir do CRM (pode ser melhoria futura, reaproveitando o `google_event_id` já guardado). Não oferecer essa integração pra contas Gmail fora do domínio `@viagente.com.br` — o app Interno bloqueia isso por natureza, o que é o comportamento esperado.

# Prompt — Etapa 31: Enriquecimento de Dados via Notas do Gemini (Meet + Drive)

## Contexto
Toda reunião no Google Meet com "Tomar notas com o Gemini" ativado gera um documento no Drive (resumo + itens de ação + transcrição), e esse documento é **anexado automaticamente ao evento da agenda** que originou a reunião. Esta etapa sincroniza esses documentos pro CRM, casando os convidados do evento (por email) com contatos já cadastrados, e exibe o resumo/transcrição na página do contato e do negócio.

**Escopo confirmado:** todas as reuniões da agenda conectada (não só as agendadas pelo próprio CRM), filtrando pelos emails de convidado que baterem com um contato. Guardar resumo **e** transcrição completa.

**Design system obrigatório:** `docs/dia1-etapas/etapa-6-design-system.md`.

**Depende de:** Etapa 12 (Google Agenda) já implementada — reaproveita a mesma conexão OAuth por usuário.

## ⚠️ Parte 1 — Ajuste manual no Google Cloud (você faz, não o Claude Code)
1. No mesmo projeto/app OAuth já criado na Etapa 12 (app tipo Interno do Workspace), adicionar o escopo `https://www.googleapis.com/auth/drive.readonly` na tela de consentimento
2. Como é app Interno, não há revisão do Google pra fazer — é só adicionar o escopo
3. **Usuários que já conectaram o Google Agenda na Etapa 12 vão precisar reconectar** pra conceder essa permissão nova (o token antigo não cobre o escopo novo)

## Parte 2 — Prompt pro Claude Code

### Migration necessária
```
meeting_notes (
  id,
  google_event_id,             -- ID do evento na agenda
  crm_user_id,                  -- qual usuário do CRM tinha essa reunião na agenda conectada
  drive_file_id UNIQUE,          -- evita duplicar se o mesmo evento aparecer na agenda de mais de um usuário
  drive_file_url,
  title,
  meeting_date,
  attendee_emails jsonb,        -- todos os convidados do evento
  summary text,
  transcript text nullable,
  action_items jsonb nullable,
  parsed_ok boolean default true,  -- false se não conseguiu separar as seções (ver item 4)
  synced_at, created_at
)

meeting_notes_contacts (
  id, meeting_note_id, contact_id, deal_id nullable,
  UNIQUE(meeting_note_id, contact_id)
)
```

### Tarefas

#### A. Sincronização (cron, reaproveitar o mecanismo já existente da Etapa 13/22)
1. Pra cada usuário com `google_calendar_connections` ativa: buscar eventos dos últimos 7-14 dias (configurável) via `events.list` da Calendar API, incluindo o campo `attachments`
2. Pra cada evento com anexo de documento do Google Docs cujo título indique nota do Gemini (ex: contém "Notes by Gemini" ou "Notas do Gemini" — **inspecionar 2-3 documentos reais antes de fixar o padrão de reconhecimento**, o formato pode variar) e cujo `drive_file_id` ainda não exista em `meeting_notes`: seguir pro passo 3
3. Buscar o conteúdo do documento via `files.export` (Drive API), como texto
4. **Parsear as seções do documento**: resumo, itens de ação/próximos passos, transcrição — Gemini organiza isso por títulos dentro do doc. Se a estrutura não for reconhecida com confiança, gravar o conteúdo bruto inteiro em `summary`, deixar `transcript` nulo, e marcar `parsed_ok = false` (pra saber depois que aquele registro merece revisão, em vez de falhar silenciosamente)
5. Extrair os emails de convidados do evento (`attendees` da Calendar API); pra cada email que bater com `contacts.email`, criar uma linha em `meeting_notes_contacts` vinculando o contato e, se houver negócio aberto pra esse contato, o negócio também (mesma heurística de "mais recentemente atualizado" já usada na Etapa 5)
6. Se **nenhum** convidado do evento bater com um contato conhecido, não gravar o `meeting_note` — não vale a pena guardar reunião sem nenhuma relação com o CRM (evita acumular dado pessoal irrelevante)

#### B. Exibição — página de contato e de negócio
7. Nova seção "Resumo de Reuniões" na página de contato (Etapa 7, `/contatos/[id]`) e na página de negócio (Etapa 8c, `/negocios/[id]`): lista cronológica das `meeting_notes` vinculadas
8. Cada item mostra: título da reunião, data, resumo (sempre visível), itens de ação (se houver), botão "Ver transcrição completa" (colapsado por padrão, já que pode ser longa), link "Abrir no Drive" (`drive_file_url`)
9. Reunião com múltiplos contatos/negócios vinculados aparece em todas as páginas relevantes (é a mesma nota, referenciada de mais de um lugar — não duplicar o conteúdo)
10. Se `parsed_ok = false`, mostrar um indicador discreto de "formato não reconhecido automaticamente" — o conteúdo bruto ainda aparece, só sem a separação por seção

## Critérios de aceite
- Reconectar a conta Google concede o escopo novo de Drive sem quebrar a conexão de agenda já existente
- Sincronização encontra uma reunião real com nota do Gemini, extrai resumo, itens de ação e transcrição corretamente
- Reunião com convidado cujo email bate com um contato aparece na página desse contato (e do negócio aberto, se houver)
- Reunião sem nenhum convidado reconhecido não é gravada no banco
- Mesmo evento não gera registro duplicado se aparecer na agenda de mais de um usuário conectado
- Documento com formato não reconhecido ainda é salvo (raw), sinalizado como não parseado, sem quebrar a sincronização dos demais
- Toda a UI nova usa exclusivamente os tokens/componentes do design system da Etapa 6

## Fora do escopo desta etapa
Não implementar isso pra outras plataformas de reunião além de Google Meet/Gemini. Não implementar edição das notas a partir do CRM — é um espelho de leitura do documento do Drive. Não implementar upload manual de nota de reunião pra encontros que não usaram o Gemini.

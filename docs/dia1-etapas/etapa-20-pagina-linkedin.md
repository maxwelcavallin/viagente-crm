# Prompt — Etapa 20: Página LinkedIn (Indicadores LeadDelta, dados sincronizados)

## Contexto
Existe um projeto de referência em `C:\Users\Obra Prima\Documents\Maxwel\Maxwel\DEV\leaddelta-dashboard` (Python/FastAPI) que já resolve a busca e o cálculo de indicadores da LeadDelta — **use-o como especificação de referência da lógica de negócio**, principalmente `analytics.py` (mapeamento de tags pra estágio de funil, detecção de perfil P1/P2, cálculo de KPIs) e `leaddelta_client.py` (endpoint real da API: `GET https://api.leaddelta.com/profiles/v1/public`, header `apikey`, paginação via `skip`/`limit`).

**Esta etapa substitui qualquer rascunho anterior sobre LinkedIn/LeadDelta que tratasse de mensagens/webhook** — esse escopo foi descartado. O escopo agora é: **só indicadores de conexões e funil de prospecção**, sem histórico de mensagens (a API da LeadDelta não oferece isso, já confirmado).

**Design system obrigatório:** `docs/dia1-etapas/etapa-6-design-system.md`.

## Decisão de arquitetura
Os dados da LeadDelta são **sincronizados pro banco do CRM** (não consultados ao vivo a cada acesso à página) — assim qualquer visualização fica possível sem depender da API a cada clique, e sem esbarrar em rate limit.

## Migration necessária
```
leaddelta_settings (id, api_key encriptado, last_synced_at, created_at)  -- config única, tipo whatsapp_channels mas 1 registro só

leaddelta_connections (
  id, leaddelta_id UNIQUE,           -- _id da API
  first_name, last_name, headline,
  company, job_title, location, location_normalized,
  email, linkedin_url, workspace_name,
  tags jsonb,                        -- array de strings
  funnel_stage,                      -- calculado a partir das tags (ver seção "Lógica de negócio")
  profile ['Perfil 1','Perfil 2','Sem perfil'],  -- calculado
  has_email, has_notes, has_phone,
  connected_at, synced_at
)

leaddelta_sync_log (id, started_at, finished_at, connections_count, status ['sucesso','erro'], error_message)
```

## Lógica de negócio (portar de `analytics.py`, não reinventar)
1. **Tags automáticas ignoradas em qualquer visualização:** `LinkedIn`, `LinkedIn 1st`, `Imported`
2. **Detecção de perfil (P1/P2):** tags terminadas em "- P2" → Perfil 2; tags da lista de prospecção sem sufixo → Perfil 1; senão, Sem perfil
3. **Mapeamento de tag → estágio de funil canônico**, unificando variantes com/sem acento e P1/P2 da mesma etapa: Prospecção 1 a 5, Em contato, Reunião, Em negociação, Fechado — mais os estágios de manutenção (Interesse futuro, Base, Clint) e saídas negativas (Sem interesse, Não converteu, Tentativas esgotadas, Sem perfil)
4. **Normalização de localização:** remove "Greater X Area", padroniza "Brazil"→"Brasil", remove duplicidade cidade=estado
5. Portar essas regras como constantes/config no código do CRM (não hardcode espalhado) — colocar num único módulo, análogo ao `analytics.py` de referência

## Tarefas

### A. Configuração e sincronização
1. Em `/configuracoes`, nova seção "LinkedIn": campo pra colar a API Key da LeadDelta (criptografada em repouso, mesma chave `CREDENTIALS_ENCRYPTION_KEY` já usada em outras integrações), status da última sincronização
2. Botão **"Sincronizar agora"**: busca todas as conexões da API (paginação completa, como no `leaddelta_client.py` de referência), faz upsert em `leaddelta_connections` (por `leaddelta_id`), recalcula `funnel_stage`/`profile`/`location_normalized`, grava em `leaddelta_sync_log`
3. Mostrar durante a sincronização um estado de carregamento (pode demorar dependendo do volume) e o resultado ao final (quantas conexões, sucesso/erro)
4. Tratar rate limit (HTTP 429) com espera e nova tentativa, igual à referência

### B. Página `/linkedin`
5. **Bloco principal (sempre visível): Funil de prospecção**
   - Funil completo por etapa (Prospecção 1 a 5 → Em contato → Reunião → Em negociação → Fechado), com taxa de conversão etapa-a-etapa
   - Versão resumida em 4 estágios cumulativos (Entrada → Contato realizado → Reunião → Fechado), com % sobre o topo e % sobre a etapa anterior
   - KPIs do funil: total de leads, ativos, fechados, taxa de conversão geral, saídas negativas, fora do funil
   - Detalhamento de saídas negativas por motivo
   - Comparação lado a lado entre Perfil 1 e Perfil 2
6. **Atrás de "Ver mais" (colapsado por padrão):**
   - KPIs gerais: total de conexões, com e-mail (nº e %), sem tag
   - Contagem por estágio (pipeline)
   - Ranking de cidades/regiões (top N)
   - Novas conexões por mês + curva acumulada
   - Distribuição por workspace
   - Cruzamento Workspace × Tag
   - Tabela completa de conexões, filtrável (tag, empresa, workspace, busca, tem e-mail, tem telefone), paginada

### C. Estados e navegação
7. Entrada "LinkedIn" na navegação principal (ícone apropriado do lucide-react)
8. Empty state se nunca foi sincronizado ainda ("Sincronize pela primeira vez pra ver os indicadores")
9. Loading skeleton nos gráficos enquanto carrega

## Critérios de aceite
- Botão "Sincronizar agora" busca e grava todas as conexões corretamente, com paginação completa
- Funil de prospecção aparece em destaque, com os mesmos números que o dashboard de referência produziria pros mesmos dados
- Comparação Perfil 1 vs Perfil 2 bate com a lógica de detecção da referência
- "Ver mais" expande os demais indicadores sem recarregar a página
- Tabela de conexões filtra corretamente por todos os critérios listados
- API Key fica criptografada e mascarada na tela após salvar
- Toda a página usa exclusivamente os tokens/componentes do design system da Etapa 6

## Fora do escopo desta etapa
Não implementar histórico de mensagens do LinkedIn (não existe na API da LeadDelta). Não implementar nenhuma automação de envio/prospecção a partir do CRM — é só leitura de indicadores. Não integrar com Unipile/LinkupAPI/PhantomBuster (decisão explícita de deixar de lado essa parte).

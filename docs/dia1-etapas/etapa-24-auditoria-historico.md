# Prompt — Etapa 24: Auditoria e Histórico de Alterações do Negócio

## Contexto
Hoje não existe registro de quem mudou o quê num negócio — se um valor for alterado ou uma etapa for trocada por engano, não há como saber quem fez ou quando. Esta etapa adiciona uma linha do tempo de alterações por negócio.

**Design system obrigatório:** `docs/dia1-etapas/etapa-6-design-system.md`.

## Migration necessária
```
deal_activity_log (
  id, deal_id, user_id nullable,   -- nullable pra registrar alterações vindas de webhook/automação, sem usuário humano
  action ['criado','editado','etapa_alterada','tag_adicionada','tag_removida',
          'ganho','perdido','excluido','campo_alterado'],
  field_name nullable, old_value nullable, new_value nullable,
  source ['manual','automacao','webhook'] default 'manual',
  created_at
)
```

## Tarefas
1. Interceptar toda mutação de `deals` (criação, edição de campos, mudança de `stage_id`, adição/remoção de tag, mudança de `status`, exclusão) e gravar uma entrada em `deal_activity_log` com o valor antes/depois
2. Diferenciar a origem (`source`): ação manual de um usuário, execução de automação (Etapa 13/22), ou webhook de entrada (Etapa 10) — isso ajuda a entender "isso mudou sozinho ou alguém mexeu?"
3. Na página de detalhe do negócio (Etapa 8c), adicionar uma aba/seção **"Histórico"**: linha do tempo cronológica, com ícone por tipo de ação, nome do usuário (ou "Automação"/"Webhook X" se não for manual), e o diff antes/depois quando aplicável
4. Paginação ou "carregar mais" se o histórico for longo

## Critérios de aceite
- Editar qualquer campo de um negócio gera uma entrada no histórico com valor antigo e novo
- Mudar de etapa (manual ou por automação) aparece no histórico com a origem correta
- Adicionar/remover tag aparece no histórico
- Marcar como ganho/perdido/excluído aparece no histórico
- Aba "Histórico" no detalhe do negócio mostra tudo em ordem cronológica, com origem clara (manual/automação/webhook)
- Toda a UI nova usa exclusivamente os tokens/componentes do design system da Etapa 6

## Fora do escopo desta etapa
Não implementar reversão automática de alteração a partir do histórico (é só consulta, não "desfazer"). Não estender esse mesmo log pra `contacts` nesta etapa — só `deals`, por ora.

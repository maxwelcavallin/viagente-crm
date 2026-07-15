# Prompt — Etapa 22: Automações Mais Inteligentes (condicional, sequência, follow-up)

## Contexto
A Etapa 13 já entregou automação por etapa/tag com atraso configurável e envio automático. Esta etapa expande isso em três direções que ainda não existem: **lógica condicional**, **sequências de múltiplos passos**, e **follow-up automático por falta de resposta**.

**Design system obrigatório:** `docs/dia1-etapas/etapa-6-design-system.md`.

## Migration necessária
```
automation_sequences (id, name, active, trigger_type ['etapa','tag','sem_resposta'],
                       trigger_stage_id nullable, trigger_tag_id nullable,
                       no_response_days nullable,   -- pro tipo 'sem_resposta'
                       conditions jsonb nullable,   -- condição extra opcional (ver seção B)
                       created_at)

automation_sequence_steps (id, sequence_id, "order",
                            delay_minutes,           -- desde o passo anterior (ou desde o gatilho, se for o primeiro)
                            type ['mensagem','tarefa_generica','tag','mudar_etapa'],
                            message_template_id nullable,
                            auto_send default false,
                            add_tag_id nullable,      -- se type='tag'
                            move_to_stage_id nullable) -- se type='mudar_etapa'

automation_sequence_runs (id, sequence_id, deal_id, current_step_order,
                           status ['em_andamento','concluida','cancelada'],
                           started_at, next_step_at nullable)
```

## Tarefas

### A. Sequências de múltiplos passos
1. Tela em `/configuracoes` pra criar uma `automation_sequence`: nome, gatilho (entrar em etapa X, ganhar tag Y, ou "sem resposta há N dias"), e uma lista ordenada de passos, cada um com atraso em relação ao passo anterior
2. Ao disparar o gatilho pra um negócio, criar um `automation_sequence_run` e agendar o primeiro passo (via cron já existente da Etapa 13, ou equivalente)
3. Ao executar um passo: aplicar a ação (enviar mensagem, criar tarefa genérica, adicionar tag, mudar de etapa) e agendar o próximo passo da sequência, respeitando o atraso configurado
4. Se o negócio for **ganho, perdido, ou excluído no meio de uma sequência**, cancelar o `automation_sequence_run` automaticamente (não continuar executando passos de um negócio fechado)

### B. Lógica condicional
5. Campo `conditions` (jsonb) na sequência: condição simples sobre `custom_fields`/`temperature`/tags do negócio (ex: `temperature = 'quente'`, `gasto_mensal_cartao >= 20000`) — se a condição não bater no momento do gatilho, a sequência não inicia
6. UI de montagem da condição: campo + operador (igual, maior que, menor que, contém) + valor — reaproveitar os `custom_field_definitions` já existentes pra popular as opções de campo

### C. Follow-up automático por falta de resposta
7. Gatilho `sem_resposta`: verificar negócios cuja última mensagem foi **enviada pelo CRM** (`direction='saida'`) e não teve nenhuma mensagem `direction='entrada'` depois, há mais de `no_response_days` dias — disparar a sequência vinculada
8. Evitar duplicar: um negócio não deve receber a mesma sequência de follow-up mais de uma vez seguida sem uma mensagem nova do contato no meio

## Critérios de aceite
- Criar uma sequência de 3 passos (ex: mensagem → espera 2 dias → tarefa → espera 1 dia → mudar etapa) executa cada passo no tempo certo, sem intervenção manual
- Sequência com condição só inicia se a condição bater no momento do gatilho
- Negócio marcado como ganho/perdido no meio de uma sequência cancela as próximas execuções automaticamente
- Gatilho "sem resposta há N dias" dispara corretamente pra negócios parados, e não duplica disparo pro mesmo negócio sem uma resposta nova no meio
- Toda a UI nova usa exclusivamente os tokens/componentes do design system da Etapa 6

## Fora do escopo desta etapa
Não implementar sugestão de próxima ação via IA/LLM (pode ser uma etapa própria futura, se quiserem). Não implementar teste A/B de sequências.

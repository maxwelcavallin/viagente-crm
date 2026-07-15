# Prompt — Etapa 23: Notificações (mensagem nova e tarefa vencida)

## Contexto
O CRM ainda não avisa o usuário de nada — ele precisa estar olhando a tela pra perceber que chegou mensagem nova ou que uma tarefa venceu. Esta etapa adiciona um centro de notificações in-app, com push do navegador como complemento.

**Design system obrigatório:** `docs/dia1-etapas/etapa-6-design-system.md` (usar o padrão de dropdown/popover pro sino de notificações, badge de contagem, e cores semânticas — nunca `--primary` pra indicar "novo", isso é dado pontual).

## Migration necessária
```
notifications (id, user_id, type ['mensagem_nova','tarefa_vencida','tarefa_atribuida'],
                deal_id nullable, task_id nullable, message_id nullable,
                title, body, read boolean default false,
                created_at)
```

## Tarefas

### A. Geração de notificações
1. Ao receber uma mensagem nova (Etapa 5, webhook `on-message-received`): criar uma `notification` tipo `mensagem_nova` pra cada usuário com acesso ao canal daquele contato (respeitando `whatsapp_channel_restrictions`), **exceto** se o usuário estiver com aquela conversa aberta na tela no momento (evitar notificação redundante — usar um sinal simples de "conversa ativa", ex: heartbeat via WebSocket/polling, ou aceitar notificar sempre e deixar o usuário simplesmente ignorar se já estiver vendo)
2. Cron (reaproveitar o mecanismo já existente da Etapa 13) que verifica tarefas com `due_at` vencido e ainda `status='pendente'`, criando notificação tipo `tarefa_vencida` pro dono do negócio — só uma vez por tarefa (marcar internamente que já notificou, pra não duplicar a cada execução do cron)

### B. Centro de notificações (in-app)
3. Sino de notificação no header, com badge de contagem de não lidas
4. Dropdown com lista das notificações mais recentes, cada uma levando pro negócio/tarefa/conversa correspondente ao clicar
5. Marcar como lida ao clicar; botão "marcar todas como lidas"
6. Atualização em tempo real ou quase (polling a cada X segundos é aceitável pra este estágio, não precisa WebSocket)

### C. Notificação push do navegador (complementar)
7. Pedir permissão de notificação do navegador na primeira vez que o usuário loga (de forma não intrusiva — explicar o motivo antes de pedir)
8. Se autorizado, disparar uma notificação nativa do navegador pros dois tipos de evento, mesmo com a aba em segundo plano
9. Se o usuário negar a permissão, o centro de notificações in-app continua funcionando normalmente (push é complemento, não requisito)

## Critérios de aceite
- Mensagem nova gera notificação pros usuários com acesso ao canal, visível no sino em poucos segundos
- Tarefa vencida gera notificação uma única vez, não repetida a cada execução do cron
- Clicar numa notificação leva direto pro contexto certo (conversa, negócio ou tarefa)
- Marcar como lida funciona, individualmente e em massa
- Notificação push do navegador funciona quando autorizada, e o sistema não quebra quando o usuário nega a permissão
- Toda a UI nova usa exclusivamente os tokens/componentes do design system da Etapa 6

## Fora do escopo desta etapa
Não implementar notificação por email nem WhatsApp pro próprio time (é só in-app + push do navegador). Não implementar preferências granulares de notificação por tipo (tudo ou nada, por enquanto).

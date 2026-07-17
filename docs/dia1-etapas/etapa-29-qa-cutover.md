# Prompt/Checklist — Etapa 29: QA Final + Cutover (desligar a Clint)

## Contexto
Esta etapa foi movida pro final de propósito — roda depois de **todas** as funcionalidades planejadas (Etapas 20 a 28), não logo após o MVP original. É a última validação antes de desligar a Clint de vez. Parte é trabalho técnico (Claude Code valida/corrige), parte é decisão e execução operacional sua.

---

## Parte A — Técnica (Claude Code)

### A1. Regressão ponta a ponta (cobrindo tudo, incluindo o que foi adicionado depois do MVP original)
1. Lead chega pelo webhook de teste → contato/negócio criados → temperatura calculada → aparece no kanban na etapa certa → `stage_task`/sequência (Etapa 22) gera tarefa → executar tarefa de mensagem → mensagem aparece em `/atendimento` → responder atualiza a conversa → exportar `.md` funciona
2. Criar negócio manual, tag, campo customizado, mover no kanban, marcar Ganho → dispara NPS automático (Etapa 27) no prazo certo
3. Cliente responde a pesquisa NPS com nota baixa → cria tarefa de follow-up automaticamente
4. Sincronizar página LinkedIn (Etapa 20) e conferir que o funil bate com o esperado
5. Mensagem no Instagram (Etapa 25) aparece em `/atendimento` junto com WhatsApp, cada uma com o ícone certo; enviar um email a partir de uma atividade (Etapa 26) funciona e fica registrado no histórico do negócio
6. Notificação (Etapa 23) aparece ao receber mensagem nova e ao vencer uma tarefa
7. Histórico de alterações (Etapa 24) registra corretamente uma mudança manual e uma automática
8. Agendar reunião confirma evento real no Google Agenda
9. Admin bloqueia atendente de um canal (WhatsApp/Instagram) e confirma que não vê nem envia por ali
10. Tema claro/escuro em pelo menos 3 telas, desktop e mobile, sem quebra
11. Testar chamada real na API pública e no servidor MCP (Etapa 28) com uma API key de teste

### A2. Checklist de produção
12. Todas as variáveis de ambiente de produção preenchidas (Vercel): banco, criptografia, storage, Google OAuth, credenciais de Instagram/email/LeadDelta — nenhuma commitada no git
13. Todos os webhooks apontando pra URLs de produção (Z-API, Instagram, Google OAuth redirect, webhooks de entrada/saída)
14. Backup do Neon confirmado ativo
15. `npm run build` roda sem erros nem warnings críticos

### A3. Auditoria de acesso
16. Cada usuário real com a `role` certa
17. Nenhum atendente bloqueado por engano de um canal que precisa usar (WhatsApp e Instagram)
18. Senhas temporárias de usuários de teste trocadas ou usuários excluídos
19. API keys de teste (Etapa 28) revogadas antes de ir pra produção, gerando as de verdade depois

---

## Parte B — Operacional (você decide e executa)

### B1. Estratégia de corte
- **Corte direto** ou **paralelo curto (2-3 dias)** — mesma decisão de sempre, agora com muito mais superfície pra validar, então o paralelo curto é ainda mais recomendável neste ponto

### B2. Migração final de verdade
20. Rodar a importação com o CSV real e atualizado da Clint, o mais perto possível do corte
21. Conferir contagem de negócios/contatos importados contra a Clint

### B3. Plano de reversão
22. Manter a Clint ativa por 1-2 semanas após o corte como rede de segurança
23. Definir responsável pela decisão de rollback e o que a dispararia

### B4. Comunicação com a equipe
24. Alinhamento sobre a navegação (menu "Configurações" consolidado, kanban com drag-and-drop, novo canal Instagram, atividade de envio de email, notificações)
25. Deixar claro que Google Agenda e LinkedIn precisam ser conectados/sincronizados individualmente

### B5. Janela de observação pós-lançamento
26. Nas primeiras 48-72h, observar: mensagens de todos os canais, negócios criados pelos webhooks reais, notificações disparando corretamente, e qualquer erro nos logs

## Critérios de aceite (Parte A)
- Todos os fluxos ponta a ponta do item A1 funcionam sem erro
- Nenhuma variável de ambiente sensível exposta no repositório
- Todos os webhooks apontam para produção
- Build de produção roda limpo
- Nenhum usuário tem acesso incorreto

## Fora do escopo desta etapa
Não implementar nenhuma funcionalidade nova — é validação e preparação de lançamento do que já existe.

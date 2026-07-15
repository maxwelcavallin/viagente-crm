# Prompt — Etapa 27: Pós-venda / NPS Automático

## Contexto
Quando um negócio vira "Cliente ativo" (última etapa do Funil Viagente) ou é marcado como Ganho, disparar uma pesquisa de satisfação automática.

**Design system obrigatório:** `docs/dia1-etapas/etapa-6-design-system.md`.

## Migration necessária
```
nps_surveys (id, deal_id, contact_id, sent_at, channel ['whatsapp','email'],
             token UNIQUE,           -- usado na URL pública de resposta
             score nullable,         -- 0-10
             feedback nullable,
             responded_at nullable,
             created_at)
```

## Tarefas
1. Reaproveitar a automação já existente (Etapa 13/22): gatilho por etapa (entrar em "Cliente ativo") ou por status (`ganho`), com atraso configurável (ex: 3 dias depois, pra não ser em cima da venda)
2. Ao disparar: criar um `nps_survey` com `token` único, enviar mensagem (WhatsApp, reaproveitando o composer/canal já configurado, ou email se o canal existir) com um link curto pra página pública `/nps/[token]`
3. Página pública `/nps/[token]` (sem necessidade de login): pergunta de 0 a 10 ("De 0 a 10, o quanto você recomendaria a Viagente?"), campo de comentário opcional, botão de enviar
4. Ao responder, gravar `score`/`feedback`/`responded_at`; se `score <= 6` (detrator), criar automaticamente uma tarefa de "Follow-up de insatisfação" pro dono do negócio
5. Adicionar ao dashboard/indicadores já existente (Etapa 16) um bloco de NPS: nota média, distribuição promotores/neutros/detratores, respostas recentes com comentário

## Critérios de aceite
- Negócio que vira "Cliente ativo"/Ganho dispara o envio da pesquisa automaticamente, no prazo configurado
- Link da pesquisa funciona sem exigir login, é responsivo (mobile-first, já que quem responde é o cliente, não a equipe)
- Resposta com nota baixa cria tarefa de follow-up automaticamente
- Indicador de NPS aparece no dashboard existente
- Toda a UI nova usa exclusivamente os tokens/componentes do design system da Etapa 6

## Fora do escopo desta etapa
Não implementar múltiplas pesquisas por negócio (uma por venda, por enquanto). Não implementar envio de lembrete pra quem não respondeu.

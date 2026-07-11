# Etapa 18 — Parâmetros de contato/negócio em mensagens

## Contexto
Templates de mensagem (Etapa 9) já suportavam variáveis (`{{nome_contato}}`, `{{valor}}` e qualquer campo customizado de contato/negócio), mas faltava o email do contato no catálogo, e a tela de atendimento (conversa 1:1 com um contato específico) não tinha nenhuma forma de inserir um dado do contato/negócio na mensagem — precisava digitar tudo à mão.

## Objetivo desta etapa
Todos os parâmetros do contato/negócio (nome, email, campos customizados) disponíveis pra usar tanto em templates quanto no composer do atendimento.

## Tarefas

### A. Templates
1. `email_contato` adicionado ao catálogo base de variáveis (`buildVariableCatalog`, `src/lib/templates.ts`), junto de `nome_contato` e `valor` — já eram exibidas e clicáveis no editor de template; só faltava essa
2. `email_contato` propagado em todos os pontos que resolvem valores reais de variável: `/tarefas`, execução de tarefa no detalhe do negócio, e envio automático (Etapa 13)

### B. Atendimento
3. Novo botão no composer (ícone `{}`, ao lado do emoji) que abre uma lista dos parâmetros disponíveis pro contato aberto: nome, email (se houver), valor do negócio aberto (se houver) e cada campo customizado com valor preenchido (contato e negócio)
4. Ao clicar num parâmetro, insere o **valor já resolvido** no texto, na posição do cursor — diferente de template, aqui não existe etapa de substituição depois (a mensagem é composta e enviada na hora pra um contato específico), então insere o texto final, não um placeholder `{{}}`

## Critérios de aceite
- Criar/editar um template mostra `email_contato` na lista de variáveis e o preview substitui corretamente
- No atendimento, o botão de parâmetros lista nome, email e campos customizados com valor pra aquele contato
- Clicar num parâmetro insere o valor no cursor, sem apagar o que já estava digitado
- Contato sem negócio aberto não trava o botão — só omite os parâmetros de negócio

## Fora do escopo desta etapa
Selecionar e aplicar um template inteiro (com variáveis já resolvidas) direto do atendimento — só inserção de parâmetro individual.

# Prompt — Etapa 11: Importação de Contatos e Negócios da Clint

## Contexto
Etapas 1-9 concluídas (base completa: contatos, campos, tags, negócios/kanban, automação de tarefa). Esta etapa traz a base ativa de clientes que hoje está na Clint pro CRM novo — **sem histórico de mensagens** (decisão já tomada: só negócios e contatos ativos).

**Design system obrigatório:** use os componentes de `docs/dia1-etapas/etapa-6-design-system.md`. Esta tela deve morar em `/configuracoes/importacao` se o ajuste de consolidação de configurações já tiver sido feito; senão, `/admin/importacao`.

## Objetivo desta etapa
Ferramenta de importação via CSV que:
1. Cria/atualiza contatos
2. Cria negócios **na pipeline e etapa corretas**, escolhidas pelo admin (não tudo jogado numa etapa genérica)
3. Preenche campos customizados a partir das colunas do CSV
4. Mostra um preview antes de confirmar, e um relatório depois

## Tarefas

### A. Upload e mapeamento
1. Tela de importação: upload de um arquivo CSV (exportado manualmente da Clint pelo usuário)
2. Ler o cabeçalho do CSV e mostrar uma UI de mapeamento: pra cada coluna do CSV, o admin escolhe pra qual campo do CRM ela vai (nome do contato, telefone, email, título do negócio, valor, ou qualquer `custom_field_definition` já cadastrada de `contato`/`negócio`) — reaproveitar o mesmo padrão de mapeamento campo-a-campo já usado no motor de webhook (Etapa 10), pra não inventar uma UI nova
3. Colunas do CSV que não forem mapeadas pra nada são ignoradas (mostrar isso claramente no preview)

### B. Destino: pipeline e etapa
4. **Seleção de pipeline e etapa de destino** — duas opções, o admin escolhe uma:
   - **Destino único:** todos os negócios importados nesse lote vão pra uma pipeline/etapa fixa, escolhida uma vez antes de importar
   - **Destino por coluna:** se o CSV tiver uma coluna com o nome da etapa/funil na Clint, mapear essa coluna e fornecer uma UI de "de-para" (nome da etapa na Clint → etapa correspondente no CRM novo), pra rotear cada negócio pra etapa certa automaticamente
5. Se uma linha do CSV referenciar uma etapa que não tem correspondência mapeada, marcar como erro nessa linha (não importar às cegas numa etapa aleatória) e reportar no relatório final

### C. Deduplicação de contato
6. Ao importar, buscar contato existente por telefone (mesma regra de índice único da Etapa 7); se existir, **atualizar** os dados/campos customizados em vez de duplicar; se não existir, criar novo
7. Negócios são sempre criados novos por linha do CSV (não há deduplicação de negócio — se rodar o mesmo arquivo duas vezes, vai duplicar negócios; avisar isso claramente na tela, com um aviso do tipo "não rode o mesmo arquivo duas vezes sem necessidade")

### D. Preview antes de confirmar
8. Antes de executar de fato, mostrar um preview das primeiras ~10 linhas já mapeadas e roteadas (contato resultante, pipeline/etapa de destino, campos preenchidos), pra o admin confirmar que o mapeamento está certo
9. Botão "Confirmar importação" só aparece depois do preview ser revisado

### E. Execução e relatório
10. Rodar a importação linha a linha (ou em lote, se for mais performático), sem travar a UI — mostrar progresso
11. Ao final, relatório: quantos contatos criados, quantos atualizados, quantos negócios criados, quantas linhas deram erro (com o motivo de cada erro, ex: "linha 47: etapa 'Follow-up' sem correspondência mapeada")
12. Log da importação persistido (pra auditoria — pode reaproveitar uma tabela simples de log, ou gravar num arquivo/registro consultável depois)

## Critérios de aceite
- Upload de CSV mostra as colunas e permite mapear cada uma pra um campo do CRM (contato, negócio, ou custom field)
- Selecionar destino único (pipeline/etapa fixa) importa todos os negócios corretamente nessa etapa
- Selecionar destino por coluna, com o de-para de etapas configurado, roteia cada negócio pra etapa certa conforme o valor da coluna
- Linha com etapa sem correspondência mapeada não é importada e aparece no relatório de erro, em vez de cair numa etapa aleatória
- Contato com telefone já existente é atualizado, não duplicado
- Preview mostra o resultado esperado antes de confirmar
- Relatório final mostra contagem de criados/atualizados/erros com detalhe suficiente pra corrigir e reimportar as linhas que falharam

## Fora do escopo desta etapa
Não importar histórico de mensagens (decisão já tomada — só negócios e contatos ativos). Não construir exportador automático direto da Clint (o CSV é exportado manualmente pelo usuário na própria Clint antes de usar esta ferramenta).

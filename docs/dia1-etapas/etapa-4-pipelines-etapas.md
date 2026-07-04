# Prompt — Etapa 4: CRUD de Pipelines e Etapas (Dia 1, CRM Viagente)

## Contexto
Última etapa do Dia 1 do CRM da Viagente. Etapas 1 (setup), 2 (schema + seed) e 3 (auth) já concluídas. Já existe no banco, via seed, a pipeline "Funil Viagente" com 7 etapas — use ela para validar a tela que você vai construir. Releia a seção 5 da `viagente-crm-spec.md` para os campos exatos de `pipelines` e `stages`.

## Objetivo desta etapa
Tela de administração onde o admin gerencia pipelines e suas etapas — isso é o que hoje a Clint chama de configuração de "funil". Só `role = admin` acessa.

## Tarefas
1. Tela `/admin/pipelines`:
   - Listar todas as pipelines existentes (deve aparecer a "Funil Viagente" do seed)
   - Botão para criar nova pipeline (nome)
2. Tela `/admin/pipelines/[id]`:
   - Listar as etapas daquela pipeline, na ordem (`order`), mostrando nome e cor
   - Criar nova etapa (nome, cor)
   - Editar nome/cor de uma etapa existente
   - Reordenar etapas (drag-and-drop ou botões subir/descer — o que for mais rápido de implementar bem)
   - Excluir etapa:
     - Se não houver nenhum `deal` vinculado àquela `stage_id`, excluir normalmente
     - Se houver `deal`(s) vinculados, **bloquear a exclusão** e mostrar mensagem clara explicando quantos negócios estão na etapa e que é preciso movê-los antes
3. Validações básicas: nome de pipeline/etapa não pode ser vazio; não permitir duas etapas com o mesmo nome na mesma pipeline

## Critérios de aceite
- Admin consegue criar uma nova pipeline do zero
- Admin consegue criar uma nova etapa dentro de uma pipeline
- Admin consegue reordenar etapas e a nova ordem persiste ao recarregar a página
- Admin consegue editar nome/cor de uma etapa
- Excluir etapa sem negócios funciona
- Tentar excluir etapa com negócios vinculados é bloqueado com mensagem explicativa
- A pipeline "Funil Viagente" do seed aparece corretamente com suas 7 etapas na ordem certa: Calculadora → Diagnóstico preenchido → Lead qualificado → Agendamento marcado → Reunião realizada → Proposta enviada → Cliente ativo
- `atendente` não consegue acessar `/admin/pipelines`

## Fora do escopo desta etapa
Não implemente `stage_tasks` (tarefa automática por etapa) ainda — isso é Dia 3. Não implemente a tela de negócios/contatos ainda (Dia 2). Esta etapa é só a configuração estrutural de pipelines e etapas.

# Etapa 17 — Editar/excluir canal WhatsApp

## Contexto
Configurações > WhatsApp permitia criar canal, testar conexão e tornar padrão, mas não editar nem excluir um canal já cadastrado — pra corrigir um token errado ou remover um canal desativado era preciso mexer direto no banco.

## Objetivo desta etapa
Editar e excluir um canal WhatsApp pela própria UI.

## Tarefas
1. `updateChannelAction`: edita nome, número e Instance ID. Token e Client-Token ficam **opcionais** no formulário de edição — em branco mantém o valor já salvo (evita ter que redigitar uma credencial só pra corrigir o nome do canal)
2. `deleteChannelAction`: remove o canal. Mensagens já trocadas por ele continuam no histórico (`messages.channel_id` vira null, `onDelete: set null`); tarefas com envio automático configurado pra esse canal (Etapa 13) e restrições de acesso por atendente também são desfeitas de forma segura (`set null`/cascade, sem erro de FK)
3. Diálogos "Editar"/"Excluir" na lista de canais, mesmo padrão visual das outras telas de configuração

## Critérios de aceite
- Editar nome/número/Instance ID de um canal funciona sem precisar redigitar token
- Trocar o token funciona quando preenchido
- Excluir um canal não quebra nada que referenciava ele (mensagens antigas, automações, restrições)

## Fora do escopo desta etapa
Editar credenciais de múltiplos canais em massa.

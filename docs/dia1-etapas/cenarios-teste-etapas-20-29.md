# Cenários de Teste — Etapas 20, 22 a 31

Documento único com cenários de teste (pré-condição → passos → resultado esperado) para validar cada etapa antes de considerá-la concluída. Etapa 21 não está aqui porque já existe e foi implementada antes deste lote.

## Sumário
- [Etapa 20 — Página LinkedIn](#etapa-20)
- [Etapa 22 — Automações Mais Inteligentes](#etapa-22)
- [Etapa 23 — Notificações](#etapa-23)
- [Etapa 24 — Auditoria e Histórico do Negócio](#etapa-24)
- [Etapa 25 — Instagram Direct](#etapa-25)
- [Etapa 26 — Envio de Email a partir de Atividades](#etapa-26)
- [Etapa 27 — Pós-venda / NPS Automático](#etapa-27)
- [Etapa 28 — API Pública + Servidor MCP](#etapa-28)
- [Etapa 29 — QA Final + Cutover](#etapa-29)
- [Etapa 30 — Central de Ajuda](#etapa-30)
- [Etapa 31 — Notas do Gemini (Meet + Drive)](#etapa-31)

---

<a id="etapa-20"></a>
## Etapa 20 — Página LinkedIn (Indicadores LeadDelta)

**Cenário 1: Primeira sincronização**
- Pré-condição: API Key da LeadDelta cadastrada em `/configuracoes`, nunca sincronizado antes
- Passos: acessar `/linkedin`; clicar em "Sincronizar agora"
- Resultado esperado: estado de carregamento aparece; ao concluir, mostra quantas conexões foram importadas; `leaddelta_sync_log` recebe um registro `sucesso`

**Cenário 2: Funil de prospecção em destaque**
- Pré-condição: sincronização concluída com conexões marcadas em várias etapas de tag
- Passos: acessar `/linkedin`
- Resultado esperado: funil completo (Prospecção 1-5 → Em contato → Reunião → Em negociação → Fechado) aparece já visível, com taxa de conversão etapa-a-etapa; versão resumida de 4 estágios também visível, com % sobre o topo e sobre a etapa anterior

**Cenário 3: Comparação Perfil 1 vs Perfil 2**
- Pré-condição: conexões com tags de ambos os perfis (com e sem sufixo "- P2")
- Passos: observar o bloco de comparação de perfis
- Resultado esperado: números de cada perfil batem com a contagem manual esperada pra cada tag

**Cenário 4: "Ver mais" expande sem recarregar**
- Passos: clicar em "Ver mais"
- Resultado esperado: KPIs gerais, ranking de cidades, crescimento mensal, workspaces, crosstab e tabela de conexões aparecem, sem reload de página

**Cenário 5: Filtro da tabela de conexões**
- Passos: na tabela expandida, filtrar por tag específica, depois por "tem e-mail = sim"
- Resultado esperado: lista reduz corretamente pra cada filtro, e os dois combinados juntos

**Cenário 6: Rate limit da API**
- Pré-condição: simular resposta 429 da API da LeadDelta (mock ou volume alto)
- Passos: rodar sincronização
- Resultado esperado: sistema espera e tenta de novo, sem falhar a sincronização inteira

**Cenário 7: API Key mascarada**
- Passos: salvar a API Key em `/configuracoes`; recarregar a página
- Resultado esperado: valor aparece mascarado, nunca em texto puro

---

<a id="etapa-22"></a>
## Etapa 22 — Automações Mais Inteligentes

**Cenário 1: Sequência de múltiplos passos**
- Pré-condição: sequência criada com 3 passos (mensagem → espera 2 dias → tarefa → espera 1 dia → mudar etapa)
- Passos: disparar o gatilho da sequência num negócio de teste; avançar o tempo (ou aguardar) até cada passo
- Resultado esperado: cada passo executa no momento certo, sem intervenção manual, e o negócio muda de etapa no passo final

**Cenário 2: Condição bloqueando início**
- Pré-condição: sequência com condição `temperature = 'quente'`; negócio de teste com `temperature = 'frio'`
- Passos: disparar o gatilho
- Resultado esperado: sequência não inicia, nenhum `automation_sequence_run` é criado

**Cenário 3: Cancelamento por fechamento do negócio**
- Pré-condição: negócio com sequência em andamento (passo 2 de 3)
- Passos: marcar o negócio como Ganho
- Resultado esperado: `automation_sequence_run` muda pra `cancelada`; próximos passos não executam

**Cenário 4: Follow-up por falta de resposta**
- Pré-condição: negócio com última mensagem `direction='saida'` há mais dias que `no_response_days`, sem resposta do contato
- Passos: rodar o cron de verificação
- Resultado esperado: sequência de follow-up dispara

**Cenário 5: Não duplicar follow-up**
- Pré-condição: mesmo cenário acima, já disparado uma vez
- Passos: rodar o cron de novo, sem nova mensagem do contato no meio
- Resultado esperado: não dispara uma segunda vez pro mesmo negócio

---

<a id="etapa-23"></a>
## Etapa 23 — Notificações

**Cenário 1: Notificação de mensagem nova**
- Pré-condição: usuário com acesso ao canal em questão, não com a conversa aberta
- Passos: enviar mensagem de teste pro WhatsApp conectado
- Resultado esperado: notificação aparece no sino em poucos segundos, com badge de contagem atualizado

**Cenário 2: Notificação de tarefa vencida, sem duplicar**
- Pré-condição: tarefa com `due_at` no passado, `status='pendente'`
- Passos: rodar o cron duas vezes seguidas
- Resultado esperado: só uma notificação é criada, não duas

**Cenário 3: Navegação a partir da notificação**
- Passos: clicar numa notificação de mensagem nova
- Resultado esperado: usuário é levado direto pra conversa correspondente em `/atendimento`

**Cenário 4: Marcar como lida**
- Passos: clicar numa notificação; depois clicar em "marcar todas como lidas" com outras pendentes
- Resultado esperado: contagem do badge reduz corretamente em ambos os casos

**Cenário 5: Push do navegador negado**
- Pré-condição: usuário nega a permissão de notificação do navegador
- Passos: gerar uma mensagem nova
- Resultado esperado: notificação in-app continua funcionando normalmente, nenhum erro no console

---

<a id="etapa-24"></a>
## Etapa 24 — Auditoria e Histórico do Negócio

**Cenário 1: Edição manual de campo**
- Passos: editar o valor de um negócio (ex: mudar `value`)
- Resultado esperado: entrada em `deal_activity_log` com `action='campo_alterado'`, `old_value`/`new_value` corretos, `source='manual'`, usuário identificado

**Cenário 2: Mudança de etapa por automação**
- Pré-condição: automação da Etapa 22 configurada pra mudar etapa
- Passos: deixar a automação executar
- Resultado esperado: entrada no histórico com `action='etapa_alterada'`, `source='automacao'`

**Cenário 3: Criação via webhook**
- Passos: disparar um payload de teste no webhook de entrada (Etapa 10) que cria um negócio novo
- Resultado esperado: entrada `action='criado'`, `source='webhook'`, sem `user_id`

**Cenário 4: Aba Histórico no detalhe do negócio**
- Passos: abrir o detalhe de um negócio com várias alterações
- Resultado esperado: linha do tempo cronológica, com ícone por tipo de ação e origem clara (manual/automação/webhook)

---

<a id="etapa-25"></a>
## Etapa 25 — Instagram Direct

**Cenário 1: Recebimento de mensagem**
- Pré-condição: canal Instagram configurado e conectado
- Passos: enviar mensagem de teste pro Instagram Business conectado
- Resultado esperado: mensagem aparece em `/atendimento` com ícone do Instagram, contato criado/identificado corretamente

**Cenário 2: Envio de resposta**
- Passos: responder pela UI do CRM
- Resultado esperado: mensagem chega de verdade no Instagram do contato

**Cenário 3: Webhook com assinatura inválida**
- Passos: enviar um payload de teste ao endpoint do webhook sem a assinatura correta (ou com `app_secret` errado)
- Resultado esperado: requisição é rejeitada, nenhum dado é processado

**Cenário 4: Controle de acesso por canal**
- Pré-condição: atendente bloqueado do canal Instagram (mesmo modelo do WhatsApp)
- Passos: atendente tenta ver/enviar mensagem por esse canal
- Resultado esperado: bloqueado tanto na UI quanto na API

---

<a id="etapa-26"></a>
## Etapa 26 — Envio de Email a partir de Atividades

**Cenário 1: Template de email com variáveis**
- Passos: criar um `email_template` com assunto e corpo usando `{{nome_contato}}` e `{{valor}}`; ver o preview com dados de exemplo
- Resultado esperado: preview mostra o texto com as variáveis substituídas corretamente

**Cenário 2: Tarefa automática tipo email**
- Pré-condição: `stage_task` tipo `email` configurada numa etapa, vinculada a um template
- Passos: mover um negócio pra essa etapa
- Resultado esperado: tarefa "Enviar email" aparece no negócio automaticamente

**Cenário 3: Executar a tarefa de email**
- Passos: clicar em "Enviar email" na tarefa; conferir que o modal abre com destinatário, assunto e corpo pré-preenchidos; anexar um arquivo; enviar
- Resultado esperado: email chega de verdade no destinatário com o anexo; tarefa é marcada como concluída automaticamente; registro aparece em `emails_sent`

**Cenário 4: Email avulso sem tarefa**
- Passos: no detalhe de um negócio sem nenhuma tarefa de email pendente, clicar no botão solto "Enviar email"
- Resultado esperado: mesmo modal de composição abre e o envio funciona normalmente, sem precisar de uma tarefa pré-existente

**Cenário 5: Histórico de emails enviados**
- Passos: abrir o detalhe de um negócio com emails já enviados
- Resultado esperado: lista mostra destinatário, assunto, data, status e anexos de cada email

**Cenário 6: Sem inbox nem recebimento**
- Passos: verificar `/atendimento`
- Resultado esperado: nenhuma conversa de email aparece ali — email não é um canal de atendimento, só atividade de envio

---

<a id="etapa-27"></a>
## Etapa 27 — Pós-venda / NPS Automático

**Cenário 1: Disparo automático**
- Pré-condição: negócio marcado como Ganho ou movido pra "Cliente ativo"
- Passos: aguardar o atraso configurado (ou simular a passagem do tempo)
- Resultado esperado: mensagem com link `/nps/[token]` é enviada automaticamente

**Cenário 2: Resposta pública sem login**
- Passos: acessar o link recebido, preencher nota e comentário, enviar
- Resultado esperado: resposta gravada em `nps_surveys`, sem exigir autenticação, funcional em mobile

**Cenário 3: Nota baixa gera follow-up**
- Passos: responder com nota ≤ 6
- Resultado esperado: tarefa "Follow-up de insatisfação" criada automaticamente pro dono do negócio

**Cenário 4: Indicador no dashboard**
- Passos: acessar o dashboard/indicadores existente
- Resultado esperado: bloco de NPS mostra nota média e distribuição promotores/neutros/detratores corretos

---

<a id="etapa-28"></a>
## Etapa 28 — API Pública + Servidor MCP (operacional + configuração)

**Cenário 1: API key operacional bloqueada de ação admin**
- Pré-condição: API key criada com `scope='operacional'`
- Passos: tentar criar uma pipeline nova via API com essa chave
- Resultado esperado: requisição rejeitada (403), mas ler/mover negócios funciona normalmente

**Cenário 2: API key admin configura tudo**
- Pré-condição: API key criada com `scope='admin'`
- Passos: criar uma pipeline, adicionar etapas, configurar uma `stage_task` automática — tudo via API
- Resultado esperado: tudo funciona, refletido nas telas normalmente

**Cenário 3: Credencial nunca exposta**
- Passos: consultar, com qualquer escopo, o endpoint de canais (WhatsApp/Instagram)
- Resultado esperado: resposta mostra status/nome, nunca token ou credencial, nem criptografada

**Cenário 4: Log de auditoria via API**
- Passos: mover um negócio de etapa usando uma API key
- Resultado esperado: `deal_activity_log` (Etapa 24) registra a ação com a origem identificando a chave usada

**Cenário 5: Servidor MCP configura pipeline e opera negócio numa sessão só**
- Passos: conectar um cliente MCP real com uma chave `admin`; pedir pra criar uma pipeline com etapas e tarefa automática, depois criar um negócio nela, mover de etapa e enviar mensagem
- Resultado esperado: tudo executa com sucesso, sem sair da sessão MCP

**Cenário 6: Chave revogada**
- Passos: revogar a API key; repetir uma chamada com ela, em qualquer escopo
- Resultado esperado: rejeitada imediatamente (401/403)

---

<a id="etapa-29"></a>
## Etapa 29 — QA Final + Cutover

**Cenário 1: Fluxo ponta a ponta completo**
- Passos: lead entra por webhook de teste → negócio criado com temperatura calculada → tarefa automática/sequência dispara → mensagem enviada via WhatsApp → resposta do contato atualiza a conversa → exportar `.md` funciona
- Resultado esperado: todo o fluxo completa sem erro em nenhuma etapa

**Cenário 2: Múltiplos canais numa só conversa + atividade de email**
- Passos: mesmo contato interage por WhatsApp e Instagram; separadamente, um email é enviado a partir de uma atividade do negócio dele
- Resultado esperado: WhatsApp e Instagram aparecem juntos na mesma linha do tempo em `/atendimento`; o email enviado aparece no histórico do negócio, não em `/atendimento`

**Cenário 3: Checklist de produção**
- Passos: revisar variáveis de ambiente, webhooks configurados, backup do Neon, build de produção
- Resultado esperado: nada aponta pra ambiente de desenvolvimento/teste; build limpo

**Cenário 4: Auditoria de acesso final**
- Passos: revisar roles de todos os usuários reais e bloqueios de canal
- Resultado esperado: nenhum acesso incorreto encontrado

**Cenário 5: Corte real**
- Passos: rodar a importação final da Clint com CSV atualizado; conferir contagem
- Resultado esperado: números batem com a Clint antes do corte oficial

---

<a id="etapa-30"></a>
## Etapa 30 — Central de Ajuda

**Cenário 1: Geração de screenshot com destaque**
- Passos: rodar `npm run generate:help-screenshots`
- Resultado esperado: imagens geradas mostram a tela certa com um destaque visual claro sobre o elemento correto, na cor `--primary`

**Cenário 2: Regeneração após mudança de UI**
- Passos: mudar a posição/label de um botão já mapeado; rodar o script de novo
- Resultado esperado: a imagem atualiza automaticamente, sem precisar editar o texto do artigo

**Cenário 3: Trilha sequencial**
- Passos: acessar `/ajuda/primeiros-passos/admin`; navegar usando "próximo" até o final
- Resultado esperado: ordem faz sentido (login → usuários → pipeline → campos/tags → whatsapp → automações → google agenda), sem pular etapas

**Cenário 4: Busca por palavra-chave**
- Passos: buscar por "tag" em `/ajuda`
- Resultado esperado: retorna artigos relevantes tanto da central de referência quanto, se aplicável, das trilhas

**Cenário 5: Visibilidade por role**
- Pré-condição: logado como atendente
- Passos: navegar a central de ajuda
- Resultado esperado: artigos marcados como admin-only (ex: configurar webhook) não aparecem

**Cenário 6: Consulta via MCP**
- Passos: usando um cliente MCP conectado (qualquer escopo), pedir pra buscar um artigo sobre "como enviar áudio no atendimento"
- Resultado esperado: a tool retorna o artigo certo, com o conteúdo correto

---

<a id="etapa-31"></a>
## Etapa 31 — Notas do Gemini (Meet + Drive)

**Cenário 1: Reconexão com escopo novo**
- Pré-condição: usuário já conectado ao Google Agenda desde a Etapa 12
- Passos: reconectar a conta pra conceder o escopo de Drive
- Resultado esperado: reconexão funciona sem quebrar a integração de agenda já existente

**Cenário 2: Sincronização de reunião real**
- Pré-condição: reunião recente com nota do Gemini gerada, convidado com email de um contato cadastrado
- Passos: rodar a sincronização
- Resultado esperado: `meeting_notes` criado com resumo, itens de ação e transcrição extraídos corretamente; `meeting_notes_contacts` vincula o contato certo

**Cenário 3: Reunião sem contato conhecido**
- Pré-condição: reunião com convidados cujos emails não batem com nenhum contato
- Passos: rodar a sincronização
- Resultado esperado: nenhum registro é criado pra essa reunião

**Cenário 4: Deduplicação entre usuários**
- Pré-condição: mesmo evento aparece na agenda de dois usuários conectados do CRM
- Passos: rodar a sincronização pros dois
- Resultado esperado: só um `meeting_note` é criado (por `drive_file_id`), sem duplicar

**Cenário 5: Documento com formato não reconhecido**
- Pré-condição: documento de nota com estrutura diferente do padrão esperado
- Passos: rodar a sincronização
- Resultado esperado: conteúdo bruto é salvo, `parsed_ok=false`, sem quebrar a sincronização das demais reuniões

**Cenário 6: Exibição na página de contato e negócio**
- Passos: abrir a página do contato e do negócio vinculados a uma reunião sincronizada
- Resultado esperado: seção "Resumo de Reuniões" aparece nos dois lugares, com resumo visível e transcrição colapsada por padrão

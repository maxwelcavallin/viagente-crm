# Prompt — Etapa 5: Atendimento via WhatsApp (Z-API) — antecipada do Dia 4

## Contexto
Etapas 1-4 concluídas (setup, schema+seed, auth, CRUD de pipelines/etapas). O schema já inclui `whatsapp_channels`, `messages.channel_id` e `whatsapp_channel_restrictions` (complemento à Etapa 2) — se ainda não incluiu, adicione antes de continuar. Esta etapa estava originalmente prevista pro Dia 4 do plano de execução, mas foi antecipada porque o atendimento via WhatsApp é obrigatório desde já. Releia a **seção 7 (Integração WhatsApp)** de `viagente-crm-spec.md`.

## Mudanças importantes em relação à spec original
- A configuração da Z-API **não fica em variável de ambiente** — fica numa tela de administração dentro do próprio CRM, e o sistema precisa suportar **mais de um número WhatsApp conectado ao mesmo tempo** (ex: um número comercial, outro de suporte). O usuário já tem conta e instância ativa na Z-API; o CRM só precisa guardar e gerenciar essas credenciais pela interface, não criar instâncias novas na Z-API.
- **Controle de acesso por canal:** por padrão, todo atendente enxerga todos os canais. O admin pode bloquear manualmente o acesso de um atendente a um canal específico. `role = admin` sempre vê todos os canais, sem exceção.

## ⚠️ Antes de codar — recomendação importante
Configure primeiro um canal apontando pra uma **instância de teste** (número que não seja o de produção da Viagente), pra validar o fluxo sem risco de mandar mensagem pra um lead real. Troque pro número de produção só no cutover final.

## Variáveis de ambiente novas nesta etapa
- Uma chave de criptografia do servidor (ex: `CREDENTIALS_ENCRYPTION_KEY`) usada para criptografar `zapi_token` e `zapi_client_token` antes de gravar no banco — **essas credenciais não podem ficar em texto puro na tabela `whatsapp_channels`**
- Credenciais de object storage para mídia: `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT` (ou equivalente S3 — documente a escolha)
- Adicionar todas ao `.env.example`

## Objetivo desta etapa
1. Tela de administração para conectar/gerenciar números WhatsApp (canais) direto no CRM, incluindo controle de quais atendentes acessam qual canal
2. Atendimento via WhatsApp funcionando de ponta a ponta nesses canais: receber mensagem → persistir no banco → aparecer numa tela de inbox (respeitando o acesso do usuário logado) → responder pela UI → mensagem sai de verdade pelo WhatsApp → status de entrega/leitura atualiza

## Tarefas

### A. Configuração de canais (`/admin/whatsapp`)
1. Tela que lista os canais configurados (`whatsapp_channels`): nome, número, status (conectado/desconectado/pendente)
2. Formulário para adicionar novo canal: nome/label, `zapi_instance_id`, `zapi_token`, `zapi_client_token`
   - Ao salvar, criptografar `zapi_token` e `zapi_client_token` antes de persistir
   - Depois de salvo, os tokens não devem ser exibidos de novo na tela (mostrar mascarado, tipo `••••••1234`)
3. Botão "Testar conexão": chama o endpoint de status da Z-API para aquela instância e atualiza o campo `status` (conectado/desconectado)
4. Botão "Reconectar" (se a Z-API expuser endpoint de QR code para instância existente que caiu a sessão): exibir o QR code na própria tela para o usuário escanear sem sair do CRM. **Se esse endpoint não existir ou não for confiável na documentação da Z-API, pule esse botão e apenas oriente o usuário a reconectar pelo painel da Z-API — não invente comportamento.**
5. Marcar um canal como padrão (`is_default`) — usado como sugestão inicial ao enviar mensagem, quando não há canal anterior na conversa
6. Só `role = admin` acessa esta tela

### B. Gestão de acesso por atendente
7. Dentro da tela de cada canal, listar os usuários com `role = atendente` com um toggle "tem acesso" (marcado por padrão = acesso liberado)
8. Desmarcar cria uma linha em `whatsapp_channel_restrictions` (bloqueando aquele usuário daquele canal); marcar de novo remove a linha
9. Usuários `admin` não aparecem nessa lista — eles sempre têm acesso a todos os canais, sem exceção

### C. Recebimento de mensagens
10. Endpoint de webhook **por canal**: `POST /api/whatsapp/webhook/[channelId]` (cada canal tem sua própria URL de webhook, configurada no painel da Z-API daquela instância — assim o CRM sempre sabe de qual canal veio o evento, sem depender do payload)
    - Tratar evento `on-message-received`: identificar contato pelo telefone (criar em `contacts` se não existir); gravar mensagem em `messages` com `direction = 'entrada'` e `channel_id` correspondente
    - Se a mensagem tiver mídia: baixar do link temporário da Z-API e subir pro object storage — gravar em `media_url` o link do storage próprio, nunca o da Z-API
    - Tratar evento `on-message-status` (SENT/DELIVERED/READ): localizar a mensagem por `z_api_message_id` e atualizar `status`
    - Validar que a requisição veio da Z-API (checar token/client-token da instância correspondente ao `channelId` da URL)

### D. Envio de mensagens
11. Endpoint interno (ex: `POST /api/messages/send`) que recebe `channel_id`, `contact_id`/telefone e texto:
    - Verificar que o usuário logado tem acesso àquele `channel_id` (não bloqueado em `whatsapp_channel_restrictions`) antes de permitir o envio
    - Chama a API de envio de texto da Z-API usando as credenciais do canal (descriptografadas em memória, nunca logadas)
    - Grava a mensagem em `messages` com `direction = 'saida'`, `status = 'enviado'`, `z_api_message_id`, `channel_id`

### E. Vínculo garantido a contato e negócio
12. Toda mensagem (entrada ou saída) grava `contact_id` sempre
13. Ao gravar uma mensagem, buscar se o contato tem um negócio (`deal`) com `status = 'aberto'` e, se houver, preencher `deal_id` automaticamente na mensagem. Se houver mais de um negócio aberto para o mesmo contato, usar o mais recentemente atualizado (`updated_at`) — é uma heurística aceitável nesta fase, não precisa de UI pra escolher manualmente ainda

### F. Exportação do histórico em Markdown
14. Endpoint `GET /api/conversations/[contactId]/export` que gera um arquivo `.md` com o histórico completo da conversa daquele contato, em ordem cronológica, contendo:
    - Cabeçalho: nome do contato, telefone, canal(is) envolvido(s), negócio vinculado (se houver), data/hora da exportação
    - Cada mensagem como `**[DD/MM/AAAA HH:mm] Cliente:**` ou `**[DD/MM/AAAA HH:mm] Equipe Viagente:**` seguido do conteúdo
    - Mensagens de mídia representadas como `📎 [Áudio]`, `📎 [Imagem]`, `📎 [Documento]` etc. com link para o arquivo no storage próprio
    - **Respeitar o controle de acesso:** se o contato conversou por mais de um canal, o export só deve incluir mensagens dos canais aos quais o usuário logado tem acesso (admin exporta tudo)
15. Botão **"Exportar conversa (.md)"** na tela `/atendimento`, dentro da conversa aberta, que chama esse endpoint e dispara o download do arquivo em um clique

### G. Tela de atendimento (`/atendimento`)
16. Lista de conversas (uma por contato), ordenada pela mensagem mais recente, mostrando por qual canal/número está passando
17. **A lista só mostra conversas de canais aos quais o usuário logado tem acesso** (admin vê todos; atendente vê todos exceto os canais em que está restrito)
18. Ao abrir uma conversa: histórico completo persistido (texto e mídia), em ordem cronológica, filtrado pelos canais permitidos pro usuário
19. Indicador visual de status por mensagem enviada (enviado/entregue/lido)
20. Campo de texto + seletor de canal, limitado aos canais que o usuário tem acesso (se o contato já tiver conversa em algum canal permitido, pré-selecionar; senão, usar o canal padrão)

### H. Documentação
21. README: como adicionar um canal na tela `/admin/whatsapp`, como gerenciar acesso por atendente, e como configurar a URL do webhook (`/api/whatsapp/webhook/[channelId]`) no painel da Z-API para aquela instância — incluir instrução de túnel local (ex: ngrok) para testar em desenvolvimento

## Critérios de aceite
- Admin consegue adicionar um canal pela UI informando as credenciais da instância Z-API existente
- Tokens do canal ficam criptografados no banco e mascarados na tela após salvar
- "Testar conexão" reflete corretamente se a instância está conectada ou não
- Admin consegue bloquear um atendente específico de um canal específico, e isso reflete imediatamente em `/atendimento` daquele atendente
- Atendente sem nenhum bloqueio continua vendo todos os canais normalmente
- Admin sempre vê todos os canais, mesmo sem estar na lista de acesso
- Mandar uma mensagem de teste pro número do canal aparece em `/atendimento` em poucos segundos, para os usuários com acesso àquele canal
- Responder pela UI chega de verdade no WhatsApp do número de teste, usando o canal certo
- Tentar enviar por um canal ao qual o usuário não tem acesso é bloqueado pela API, não só escondido na UI
- Status da mensagem evolui de "enviado" para "entregue"/"lido" conforme os webhooks de status chegam
- Mensagem recebida com mídia (testar com imagem e áudio) fica acessível por uma URL do storage próprio
- Histórico de conversa continua acessível depois de recarregar a página
- Se você configurar um segundo canal de teste, mensagens de cada número aparecem separadas por canal, sem se misturar
- Mensagens de um contato com negócio aberto aparecem com `deal_id` preenchido automaticamente
- Botão "Exportar conversa (.md)" baixa um arquivo com o histórico completo, legível, com timestamps e identificação de remetente, respeitando o acesso do usuário
- Arquivo exportado abre corretamente em qualquer leitor de Markdown (testar abrindo no VS Code, por exemplo)

## Fora do escopo desta etapa
Não implemente criação de instância nova diretamente na Z-API (isso é ação de conta/billing do lado da Z-API, fora do CRM). Não implemente envio de mídia pela UI ainda (só recebimento de mídia + envio de texto) — anexos, áudio, emoji, responder e favoritar mensagens são a **Etapa 5b** (`etapa-5b-atendimento-completo.md`), rodada logo em seguida a esta. Não implemente UI para escolher manualmente qual negócio vincular quando houver mais de um aberto — a heurística automática (mais recente) é suficiente por agora.

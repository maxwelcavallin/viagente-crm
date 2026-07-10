# Correção — Erro de Fetch no Áudio

## Contexto
Bug reportado: "erro de fetch" relacionado a áudio no `/atendimento` (recebido e/ou gravado na Etapa 5b). Não há stack trace específico neste documento — a primeira tarefa é reproduzir e diagnosticar antes de aplicar qualquer correção. Não adivinhe a causa e mude código às cegas — confirme a causa real primeiro.

## Passo 1 — Reproduzir e diagnosticar
1. Reproduza o erro (enviar áudio gravado, ou reproduzir um áudio recebido) e capture:
   - Mensagem completa do erro no console do navegador
   - Aba Network: qual requisição falhou, status HTTP, e se é erro de CORS, 403, 404, timeout ou outro
   - Logs do servidor (rota de upload/envio de áudio) no momento do erro
2. Com base nisso, identifique qual das hipóteses abaixo é a causa real (pode ser mais de uma).

## Hipóteses mais prováveis nesta arquitetura (verificar cada uma)

**A. CORS no bucket R2/S3**
Se o áudio é reproduzido direto de uma URL do bucket (não por uma rota própria da API), o navegador precisa de CORS liberado no bucket pra GET (e possivelmente Range, já que players de áudio fazem requisições parciais). Verificar a política de CORS do bucket — se não permitir o domínio da aplicação (incluindo localhost em dev), o fetch falha silenciosamente ou com erro de CORS no console.
Correção recomendada: em vez de expor a URL do bucket direto pro navegador, criar uma rota própria (ex: GET /api/media/[id]) que busca o arquivo no servidor e faz stream de volta — evita depender de CORS do bucket e também evita expor a URL do storage diretamente.

**B. URL assinada (signed URL) expirada**
Se a mídia usa URL assinada com tempo de expiração, uma URL antiga salva em messages.media_url pode já ter expirado quando o usuário tenta reproduzir depois. Verificar se media_url guarda uma signed URL com TTL ou uma URL pública permanente.
Correção recomendada: guardar em media_url só a chave/caminho do objeto no bucket, e gerar a signed URL sob demanda (ou usar a rota própria do item A) toda vez que for exibida — nunca guardar uma signed URL com prazo de expiração como valor permanente no banco.

**C. Content-Type incorreto no upload**
Se o arquivo de áudio foi salvo no bucket sem o Content-Type correto (ex: application/octet-stream em vez de audio/webm ou audio/ogg), o elemento audio do navegador pode recusar reproduzir ou o fetch pode se comportar de forma inesperada.
Verificar o Content-Type setado no upload (tanto pro áudio gravado na Etapa 5b quanto pro áudio recebido via Z-API) e corrigir se estiver genérico.

**D. Mimetype do MediaRecorder incompatível com o envio pra Z-API**
O MediaRecorder do navegador tipicamente grava em audio/webm ou audio/ogg;codecs=opus, dependendo do navegador. Se o endpoint de envio de áudio da Z-API espera um formato específico (verificar documentação da Z-API para envio de áudio) e o arquivo enviado não bate, a chamada de envio pode falhar com erro de fetch do lado do servidor (ao chamar a Z-API), não do navegador.
Verificar se é necessário conversão de formato antes de enviar pra Z-API, ou se o formato do navegador já é aceito.

## Passo 2 — Corrigir e validar
3. Aplicar a correção correspondente à causa real identificada
4. Testar novamente: gravar e enviar áudio, receber e reproduzir áudio, em pelo menos dois navegadores diferentes (Chrome e Safari, se possível — eles diferem no formato padrão do MediaRecorder)
5. Documentar no README qual era a causa raiz e a correção aplicada, pra não repetir o problema em etapas futuras que também lidam com mídia

## Critérios de aceite
- Áudio gravado no navegador é enviado com sucesso e chega no WhatsApp do destinatário
- Áudio recebido no WhatsApp é reproduzível no /atendimento sem erro no console
- Testado em pelo menos dois navegadores diferentes
- Causa raiz documentada no README ou num comentário no código, pra referência futura

# Prompt — Etapa 28: API Pública + Servidor MCP

## Contexto
Expor o CRM pra ser consultado/operado por agentes de IA (Claude e outros), reaproveitando toda a lógica de negócio já construída.

## Migration necessária
```
api_keys (id, label, key_hash, scopes jsonb, created_by_user_id, last_used_at,
          active default true, created_at)
```

## Tarefas

### A. API pública REST
1. Endpoints de leitura: listar/detalhar negócios, contatos, mensagens (histórico de conversa), tarefas — com filtros equivalentes aos já usados nas telas (Etapa 8)
2. Endpoints de ação: mover negócio de etapa, criar tarefa, marcar tarefa como concluída, enviar mensagem (reaproveitando o endpoint de envio já existente da Etapa 5)
3. Autenticação por API key (header `Authorization: Bearer`), gerada em `/configuracoes` → API, com escopos básicos (leitura / leitura+escrita)
4. Rate limiting básico por chave, pra evitar abuso

### B. Servidor MCP
5. Servidor MCP (remoto, seguindo a especificação do Model Context Protocol) expondo os mesmos recursos como *tools*: consultar negócios por etapa/filtro, ver histórico de conversa de um negócio, mover negócio de etapa, criar tarefa, enviar mensagem
6. Documentar a URL do servidor MCP e como conectar (ex: Claude, Claude Desktop, outros clientes MCP)
7. Mesma autenticação por API key da Parte A

## Critérios de aceite
- API key criada em `/configuracoes` funciona pra autenticar chamadas REST
- Endpoints de leitura retornam dados corretos e respeitam os mesmos filtros/permissões das telas
- Endpoint de ação (mover etapa, enviar mensagem) funciona de ponta a ponta via API
- Servidor MCP responde a um cliente MCP real (testar com Claude Desktop ou equivalente) e consegue executar pelo menos uma consulta e uma ação
- Chave revogada/inativa deixa de funcionar imediatamente

## Fora do escopo desta etapa
Não implementar OAuth pra terceiros (só API key, mais simples pro estágio atual). Não expor endpoints de administração (usuários, canais, credenciais) via API pública — só dados operacionais de negócio.

# Prompt — Etapa 5b: Atendimento Completo (Anexos, Áudio, Emoji, Responder e Favoritar)

## Contexto
Complemento à Etapa 5 (WhatsApp/Z-API), que já cobre envio/recebimento de texto, recebimento de mídia, canais múltiplos e controle de acesso. Esta etapa completa o `/atendimento` com as funcionalidades de chat que a Clint já oferece e que são indispensáveis pro uso diário da equipe: anexar e enviar mídia, gravar áudio, colar (Ctrl+V) imagem e texto, emoji picker, responder/citar mensagem, e favoritar mensagens.

**Design system obrigatório:** use exclusivamente os tokens/componentes de `docs/dia1-etapas/etapa-6-design-system.md` (ícones lucide-react, dropdown/popover, botões).

## Migration incremental necessária (schema)

A tabela `messages` já existe desde a Etapa 2. Adicionar:

```
messages — colunas novas:
  favorited            boolean default false
  reply_to_message_id  FK messages(id), nullable  -- mensagem sendo respondida/citada
```

Não recrie a tabela `messages` do zero — é migration incremental.

## Objetivo desta etapa
1. Enviar mídia pela UI (imagem, vídeo, documento, áudio gravado)
2. Colar (Ctrl+V) imagem da área de transferência direto no composer
3. Emoji picker
4. Responder/citar uma mensagem específica
5. Favoritar mensagens e visualizar as favoritas de uma conversa

## Tarefas

### A. Envio de mídia (anexos)
1. Botão de anexo (ícone de clipe) no composer abre seletor de arquivo — aceitar imagem, vídeo, documento e áudio
2. Ao selecionar, mostrar preview antes de enviar (thumbnail pra imagem/vídeo, ícone + nome de arquivo pra documento), com opção de cancelar antes de enviar
3. Upload do arquivo pro **mesmo object storage (R2/S3)** já usado pra mídia recebida na Etapa 5 — não duplicar lógica de storage, reaproveitar
4. Chamar o endpoint de envio de mídia correspondente da Z-API (imagem/vídeo/documento, conforme o tipo), gravar em `messages` com `direction='saida'`, `type` correto, `media_url` apontando pro storage próprio, `channel_id` do canal ativo na conversa

### B. Gravação e envio de áudio
5. Botão de microfone no composer: ao clicar, inicia gravação via `MediaRecorder` do navegador (solicitar permissão de microfone); mostrar indicador de gravação em andamento com duração decorrida
6. Ao parar a gravação, mostrar preview do áudio gravado (player simples, com play/pause) e opções de descartar ou enviar
7. Ao enviar: mesmo fluxo do item A (upload pro storage + chamada ao endpoint de áudio da Z-API + registro em `messages` com `type='audio'`)

### C. Colar (Ctrl+V) com mídia e texto
8. Listener do evento `paste` no composer:
   - Se a área de transferência contiver uma imagem (ex: print de tela colado), tratar como anexo — mostrar o mesmo preview do item A.2, pronto pra enviar
   - Se contiver texto, colar normalmente no campo (comportamento nativo do navegador — não interceptar nem quebrar esse caso)

### D. Emoji picker
9. Botão de emoji no composer abre um seletor de emojis (biblioteca leve de React); ao escolher um emoji, inserir no texto exatamente na posição do cursor, sem perder o que já estava digitado

### E. Responder / citar mensagem
10. Ao passar o mouse (desktop) ou manter toque (mobile) sobre uma mensagem, exibir a ação "Responder"
11. Ao acionar, o composer mostra uma prévia compacta da mensagem citada logo acima do campo de texto, com opção de cancelar a citação antes de enviar
12. Mensagem enviada/recebida com `reply_to_message_id` preenchido mostra, dentro da própria bolha, um card compacto citando a mensagem original (texto resumido, ou indicação de tipo se for mídia — ex: "📎 Imagem"); clicar no card rola a conversa até a mensagem original

### F. Favoritar mensagens
13. Ao passar o mouse/tocar numa mensagem, exibir a ação "Favoritar" (ícone de estrela) — alterna o campo `messages.favorited`
14. No header da conversa, um botão/filtro "Favoritas" que exibe só as mensagens favoritadas daquela conversa, mantendo o contexto de quem enviou e quando

## Critérios de aceite
- Enviar uma imagem pelo anexo chega de verdade no WhatsApp do destinatário e aparece no histórico com preview
- Gravar um áudio, ouvir o preview e enviar funciona; o áudio chega no WhatsApp do destinatário
- Colar uma imagem copiada (print de tela) direto no composer mostra preview de anexo pronto pra enviar
- Colar texto copiado continua funcionando normalmente no campo de texto (não quebrou com a mudança do item C)
- Emoji picker insere o emoji na posição correta do cursor
- Responder uma mensagem mostra a citação no composer, e depois de enviada a bolha mostra o card de citação clicável que rola até a original
- Favoritar uma mensagem e depois filtrar por "Favoritas" mostra só as marcadas, na conversa certa
- Toda a UI nova usa os tokens/componentes do design system da Etapa 6, sem cor ou padrão ad-hoc

## Fora do escopo desta etapa
Não implementar encaminhar mensagem pra outro contato/conversa. Não implementar edição ou exclusão de mensagem já enviada — isso depende de regras próprias de janela de tempo do WhatsApp/Z-API e fica pra uma etapa futura, se for necessário.

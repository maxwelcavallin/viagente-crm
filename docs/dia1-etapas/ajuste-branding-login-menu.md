# Ajuste — Logo no login + ícone de marca no menu

## Contexto
A tela de login não tinha a logo da Viagente, e o item de menu "WhatsApp — Canais e Acesso" era o único em Configurações sem um ícone de marca (usava um ícone genérico de celular).

## Tarefas
1. Logo Viagente na tela de login — versão colorida (navy + dourado) no tema claro, versão branca no tema escuro, trocando automaticamente via CSS (`dark:hidden`/`dark:block`), sem JS. Assets em `public/viagente-logo.png` e `public/viagente-logo-dark.png`
2. Ícone de marca do WhatsApp: `lucide-react` não tem ícones de logotipo de terceiros, então foi criado `src/components/icons/whatsapp-icon.tsx` (glifo oficial recriado como componente próprio, mesma assinatura de props de um ícone lucide — `size`, `className` — pra encaixar nos mesmos lugares)
3. Item de menu renomeado de "WhatsApp — Canais e Acesso" pra **"Conexão de canais"**, usando o novo ícone — vale tanto pro menu lateral de Configurações quanto pros cards da página `/configuracoes` (mesma lista `SETTINGS_NAV_ITEMS` alimenta os dois)

## Critérios de aceite
- Logo aparece legível nos dois temas (claro/escuro) na tela de login
- Menu de Configurações mostra o ícone do WhatsApp de verdade no item de canais, com o nome novo

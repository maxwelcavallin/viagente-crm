# Prompt — Etapa 3: Autenticação e Gestão de Usuários (Dia 1, CRM Viagente)

## Contexto
Continuação do CRM da Viagente. Etapas 1 (setup) e 2 (schema + seed) já concluídas — a tabela `users` já existe no banco. Leia `viagente-crm-spec.md` se precisar relembrar o modelo de dados.

## Decisão de abordagem (adote — time pequeno de 1-3 pessoas, priorizar simplicidade sobre robustez nesta fase)
- Login por email + senha (Auth.js / NextAuth, Credentials provider)
- Senhas com hash (bcrypt)
- **Convite simplificado sem envio de email**: o admin cria o usuário direto na UI informando nome, email e role; o sistema gera uma senha temporária aleatória e **exibe ela uma única vez na tela** para o admin copiar e repassar manualmente (WhatsApp, etc.) — nada de serviço de email nesta etapa, isso pode vir depois
- Adicionar campo `must_change_password` (boolean) em `users`: true por padrão ao criar; ao logar pela primeira vez, o usuário é obrigado a trocar a senha antes de acessar o resto do sistema
- Duas roles: `admin` e `atendente`

## Objetivo desta etapa
Sistema de login funcional com controle de acesso por role, e uma tela de admin para gerenciar usuários.

## Tarefas
1. Configurar Auth.js com Credentials provider usando a tabela `users` existente
2. Middleware/guard que redireciona usuário não autenticado para `/login` ao tentar acessar qualquer rota protegida
3. Tela `/login` (email + senha)
4. Fluxo de troca obrigatória de senha no primeiro acesso (`must_change_password = true`)
5. Tela de admin `/admin/usuarios`:
   - Listar usuários existentes (nome, email, role)
   - Criar novo usuário (nome, email, role) → gera senha temporária e exibe uma vez na tela com aviso "copie agora, não será mostrada de novo"
6. Controle de acesso: rotas/telas de admin (ex: `/admin/*`) só acessíveis por role `admin`; `atendente` recebe 403 ou é redirecionado
7. Logout funcional (invalida sessão)
8. Criar o primeiro usuário admin via seed ou script de setup (documentar no README como logar pela primeira vez em um ambiente novo)

## Critérios de aceite
- Login com email/senha funciona e cria sessão válida
- Rota protegida redireciona para `/login` se não autenticado
- Novo usuário criado pelo admin consegue logar com a senha temporária
- No primeiro login, sistema força troca de senha antes de liberar o resto do sistema
- `atendente` não consegue acessar `/admin/usuarios` (nem ver o link no menu)
- `admin` acessa `/admin/usuarios` normalmente
- Logout invalida a sessão (tentar voltar por atalho não mantém acesso)

## Fora do escopo desta etapa
Não crie CRUD de pipelines/etapas ainda (Etapa 4). Não implemente recuperação de senha por email — se o usuário esquecer a senha, por enquanto o admin reseta manualmente (pode adicionar um botão "gerar nova senha temporária" no `/admin/usuarios` se for rápido, mas não é obrigatório nesta etapa).

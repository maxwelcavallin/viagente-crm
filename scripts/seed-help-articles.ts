// Popula a Central de Ajuda (Etapa 30). Reexecutável: apaga e recria tudo
// (help_categories/help_articles são 100% controladas por este script, sem
// tela de administração — reescrever aqui e rodar de novo é o fluxo normal
// de atualização de conteúdo). Rodar com: npm run seed:help
import { db } from "../src/db";
import { helpArticles, helpCategories } from "../src/db/schema";

type Track = "primeiros_passos_admin" | "primeiros_passos_atendente" | "referencia";
type RoleVisibility = "todos" | "admin" | "atendente";

type CategoryDef = { slug: string; name: string; icon: string; order: number };
type ArticleDef = {
  categorySlug: string | null;
  slug: string;
  title: string;
  track: Track;
  order?: number;
  roleVisibility?: RoleVisibility;
  content: string;
};

const categories: CategoryDef[] = [
  { slug: "atendimento", name: "Atendimento", icon: "MessagesSquare", order: 1 },
  { slug: "negocios", name: "Negócios e Pipeline", icon: "Kanban", order: 2 },
  { slug: "contatos", name: "Contatos", icon: "Users", order: 3 },
  { slug: "tarefas-automacao", name: "Tarefas e Automação", icon: "ListChecks", order: 4 },
  { slug: "reunioes-agenda", name: "Reuniões e Google Agenda", icon: "CalendarClock", order: 5 },
  { slug: "email", name: "Email", icon: "Mail", order: 6 },
  { slug: "pos-venda-nps", name: "Pós-venda (NPS)", icon: "Star", order: 7 },
  { slug: "notificacoes", name: "Notificações", icon: "Bell", order: 8 },
  { slug: "dashboard", name: "Painel Início", icon: "LayoutDashboard", order: 9 },
  { slug: "linkedin", name: "LinkedIn (LeadDelta)", icon: "Linkedin", order: 10 },
  { slug: "config-usuarios", name: "Usuários e Permissões", icon: "UserCog", order: 11 },
  { slug: "config-pipelines", name: "Pipelines e Etapas", icon: "Workflow", order: 12 },
  { slug: "config-campos-tags", name: "Campos Customizados e Tags", icon: "Tag", order: 13 },
  { slug: "config-templates", name: "Templates de Mensagem e Email", icon: "FileText", order: 14 },
  { slug: "config-canais", name: "Conexão de Canais", icon: "Link2", order: 15 },
  { slug: "config-webhooks", name: "Webhooks", icon: "Webhook", order: 16 },
  { slug: "config-importacao", name: "Importação de Dados", icon: "Upload", order: 17 },
  { slug: "config-negocio-automatico", name: "Negócio Automático", icon: "Sparkles", order: 18 },
  { slug: "config-api", name: "API e MCP", icon: "Terminal", order: 19 },
];

const articles: ArticleDef[] = [
  // ---------- Primeiros passos — Admin ----------
  {
    categorySlug: null,
    slug: "pp-admin-1-login",
    title: "Primeiro login e troca de senha",
    track: "primeiros_passos_admin",
    order: 1,
    content: `## O que é
No primeiro acesso ao CRM (ou depois que um admin recria seu acesso), você recebe um email/telefone e uma **senha temporária** — ela só é mostrada uma única vez pra quem criou o usuário, então guarde-a com cuidado até completar este passo.

## Passo a passo
1. Acesse a tela de login com o email e a senha temporária informados.
2. O sistema detecta automaticamente que sua senha é temporária e te redireciona pra tela de **Trocar senha**, sem deixar acessar o resto do sistema antes.
3. Digite a senha temporária e a nova senha desejada.
4. Ao confirmar, você é desconectado e precisa logar de novo com a senha nova — isso garante que a sessão usa as credenciais atualizadas.

## Perguntas frequentes
**Esqueci minha senha, e agora?** Não há recuperação de senha por email nesta versão do sistema — peça pra um administrador entrar em [Configurações → Usuários](/configuracoes/usuarios) e recriar seu acesso (isso gera uma nova senha temporária).`,
  },
  {
    categorySlug: null,
    slug: "pp-admin-2-usuarios",
    title: "Convidar usuários da equipe",
    track: "primeiros_passos_admin",
    order: 2,
    content: `## O que é
Cadastro dos usuários que vão acessar o CRM — administradores (acesso total, incluindo Configurações) e atendentes (uso do dia a dia: negócios, contatos, atendimento, tarefas).

## Passo a passo
1. Acesse [Configurações → Usuários](/configuracoes/usuarios).
2. Preencha nome, email e escolha o papel (Atendente ou Admin).
3. Ao salvar, o sistema gera uma senha temporária e mostra na tela **uma única vez** — copie e repasse pra pessoa por um canal seguro.
4. A pessoa loga com essa senha e é obrigada a trocá-la no primeiro acesso.
5. Se quiser restringir a visibilidade desse atendente (ele só vê negócios/atendimentos que são dele ou sem dono, nunca os de colegas), ative o switch **"Restringir aos próprios negócios/atendimentos"** ao editar o usuário.

## Perguntas frequentes
**Posso ter mais de um admin?** Sim, sem limite. **Posso remover o último admin do sistema?** Não — o sistema bloqueia rebaixar ou excluir o último administrador, pra nunca ficar sem ninguém com acesso às Configurações.`,
  },
  {
    categorySlug: null,
    slug: "pp-admin-3-pipeline",
    title: "Criar sua primeira pipeline e etapas",
    track: "primeiros_passos_admin",
    order: 3,
    content: `## O que é
A pipeline é o funil de vendas (ex: "Vendas", "Pós-venda"), dividido em etapas (colunas do kanban) que representam o estágio de cada negócio.

## Passo a passo
1. Acesse [Configurações → Pipelines](/configuracoes/pipelines) e clique em criar nova pipeline (ou clone uma existente, o que já traz etapas, tarefas automáticas e motivos de perda copiados).
2. Abra a pipeline criada e cadastre as etapas na ordem desejada (nome + cor) — reordene arrastando ou pelas setas.
3. Em cada etapa, defina os **motivos de perda** que farão sentido pra ela e, se quiser, uma **tarefa automática** que é criada sozinha assim que um negócio entra ali (ex: "Ligar em até 1 dia").
4. Opcionalmente, configure a **distribuição automática de donos** da pipeline — sem isso, negócios criados sem dono explícito continuam sem dono.

## Perguntas frequentes
**Posso excluir uma etapa ou pipeline com negócios dentro?** Não — o sistema bloqueia a exclusão enquanto houver negócios nela, exatamente pra evitar perda de dados por engano.`,
  },
  {
    categorySlug: null,
    slug: "pp-admin-4-campos-tags",
    title: "Cadastrar campos customizados e tags",
    track: "primeiros_passos_admin",
    order: 4,
    content: `## O que é
Campos customizados adicionam informações extras (além de nome/telefone/email) a contatos e negócios. Tags são etiquetas coloridas pra classificar e filtrar.

## Passo a passo
1. Em [Configurações → Campos Customizados](/configuracoes/campos), escolha a entidade (Contato ou Negócio), defina o rótulo, o tipo (Texto, Número, Select ou Data) e, se for Select, as opções.
2. Em [Configurações → Tags](/configuracoes/tags), cadastre as tags que fizerem sentido pro seu processo (nome + cor).
3. Reordene campos e tags arrastando, se quiser mudar a ordem de exibição.

## Perguntas frequentes
**Posso mudar o tipo de um campo depois de criado?** Não — só rótulo e opções (se for Select) podem ser editados depois; entidade, chave técnica e tipo ficam travados pra não quebrar dados já preenchidos.`,
  },
  {
    categorySlug: null,
    slug: "pp-admin-5-whatsapp",
    title: "Conectar um canal do WhatsApp",
    track: "primeiros_passos_admin",
    order: 5,
    content: `## O que é
Um canal WhatsApp conecta um número de telefone ao CRM via Z-API (provedor terceirizado), permitindo enviar e receber mensagens direto pelo Atendimento.

## Passo a passo
1. Crie uma instância na Z-API e tenha em mãos o **Instance ID**, o **Token** e o **Client-Token**.
2. Em [Configurações → WhatsApp](/configuracoes/whatsapp), clique em adicionar canal e preencha esses dados junto com um nome pro canal.
3. Abra o canal criado e copie a **URL de webhook** exibida — cole ela no painel da Z-API, nas abas "Ao receber" e "Status da mensagem".
4. Volte pro CRM e clique em **"Testar conexão"** pra confirmar que está tudo certo.
5. Se for o único canal (ou o principal), marque-o como **padrão**.

## Perguntas frequentes
**Preciso reconfigurar algo se meu celular desconectar da Z-API?** Não pelo lado do CRM — reconecte o WhatsApp normalmente no painel da Z-API; o canal aqui continua com a mesma configuração.`,
  },
  {
    categorySlug: null,
    slug: "pp-admin-6-tarefas-templates",
    title: "Configurar tarefas automáticas e templates",
    track: "primeiros_passos_admin",
    order: 6,
    content: `## O que é
Templates são textos reutilizáveis (mensagem ou email) com variáveis que o sistema substitui automaticamente. Tarefas automáticas de etapa usam esses templates pra guiar o atendente (ou até enviar sozinhas).

## Passo a passo
1. Em [Configurações → Templates](/configuracoes/templates), crie os templates de mensagem e de email que sua equipe mais usa — o painel lateral mostra as variáveis disponíveis (nome do contato, valor do negócio, campos customizados) clicáveis pra inserir no texto.
2. Em [Configurações → Pipelines](/configuracoes/pipelines) → [sua pipeline] → etapa, associe um template à tarefa automática daquela etapa.
3. Se quiser que a mensagem saia sozinha, sem precisar de um clique do atendente, ative **"Enviar automaticamente"** e escolha o canal.

## Perguntas frequentes
**De onde vêm as variáveis do template?** Nome, email e valor do negócio já existem prontos; campos customizados que você cadastrar em Contatos/Negócios viram variável automaticamente, sem configuração extra aqui.`,
  },
  {
    categorySlug: null,
    slug: "pp-admin-7-google-agenda",
    title: "Conectar o Google Agenda",
    track: "primeiros_passos_admin",
    order: 7,
    content: `## O que é
Conecta sua conta pessoal do Google Agenda pra permitir agendar reuniões de verdade (com convite automático pro contato) direto de um negócio.

## Passo a passo
1. Acesse [Configurações → Google Agenda](/configuracoes/google-agenda) (ou [Perfil](/perfil), se você for atendente — a conexão é sempre pessoal, de quem está logado).
2. Clique em conectar e autorize o acesso na tela do Google.
3. Se quiser que outros atendentes usem sua agenda pra agendar reuniões sem precisar conectar a própria conta, ative o compartilhamento pra eles na lista abaixo.

## Perguntas frequentes
**A conexão é única pra empresa toda?** Não — cada admin ou atendente que acessar essa tela vê e gerencia a própria conexão pessoal, mesmo estando dentro de "Configurações".`,
  },
  {
    categorySlug: null,
    slug: "pp-admin-8-configuracoes",
    title: "Visão geral das Configurações",
    track: "primeiros_passos_admin",
    order: 8,
    content: `## O que é
Um resumo de tudo que existe em **Configurações** (acesso exclusivo de administradores), pra você saber onde procurar cada coisa depois.

## O que tem lá
- [Usuários](/configuracoes/usuarios): cadastro de admins/atendentes e restrição de visibilidade.
- [Pipelines e Etapas](/configuracoes/pipelines): funis, etapas, tarefas automáticas, motivos de perda, distribuição de donos.
- [Campos Customizados](/configuracoes/campos) e [Tags](/configuracoes/tags): informações extras e classificação de contatos/negócios.
- [Templates](/configuracoes/templates): textos reutilizáveis de mensagem e email.
- Conexão de Canais: [WhatsApp](/configuracoes/whatsapp) e [Instagram](/configuracoes/instagram).
- [Automações](/configuracoes/automacoes): automações por tag e [Sequências](/configuracoes/sequencias) de múltiplos passos (além das tarefas automáticas de etapa, que ficam dentro de [Pipelines](/configuracoes/pipelines)).
- [Negócio Automático](/configuracoes/negocio-automatico): cria negócio sozinho na primeira mensagem de um contato novo.
- [Pós-venda (NPS)](/configuracoes/nps): pesquisa de satisfação automática.
- [Email](/configuracoes/email): configuração de envio (não é caixa de entrada, só saída).
- [Webhooks](/configuracoes/webhooks): capturar leads externos (entrada) e notificar outros sistemas (saída).
- [Importação de Dados](/configuracoes/importacao): importar contatos/negócios via CSV.
- [Google Agenda](/configuracoes/google-agenda): sua conexão pessoal e compartilhamento.
- [LinkedIn](/configuracoes/linkedin): configuração da sincronização com o LeadDelta.
- [API](/configuracoes/api): chaves de API e documentação do servidor MCP.

## Perguntas frequentes
**Um atendente consegue ver essas telas?** Não — a seção inteira de Configurações é bloqueada pra quem não é admin, sem exceção.`,
  },

  // ---------- Primeiros passos — Atendente ----------
  {
    categorySlug: null,
    slug: "pp-atendente-1-login",
    title: "Primeiro login e troca de senha",
    track: "primeiros_passos_atendente",
    order: 1,
    content: `## O que é
Seu acesso foi criado por um administrador, que te passou um email e uma senha temporária.

## Passo a passo
1. Acesse a tela de login com o email e a senha temporária recebidos.
2. O sistema já te leva direto pra tela de **Trocar senha** — não dá pra usar o resto do CRM antes disso.
3. Digite a senha temporária e escolha sua senha definitiva.
4. Faça login de novo com a senha nova.

## Perguntas frequentes
**Esqueci minha senha depois disso.** Peça pra um administrador recriar seu acesso em [Configurações → Usuários](/configuracoes/usuarios) (gera uma senha temporária nova) — não há recuperação por email.`,
  },
  {
    categorySlug: null,
    slug: "pp-atendente-2-kanban",
    title: "Navegando o kanban de negócios",
    track: "primeiros_passos_atendente",
    order: 2,
    content: `## O que é
Em **Negócios**, cada coluna é uma etapa da pipeline e cada card é uma oportunidade em andamento com um contato.

## Passo a passo
1. Escolha a pipeline no topo, se sua empresa tiver mais de uma.
2. Use os filtros (busca, status, dono, tag, temperatura) pra achar o que precisa — o padrão mostra só negócios **Abertos**.
3. Clique num card pra ver todos os detalhes, tarefas e histórico de conversa daquele negócio.
4. Pra mover um negócio de etapa, arraste o card pra outra coluna (ou use o menu "..." → "Mover para...").
5. Toda ação de mover mostra um aviso com **"Desfazer"**, caso mova errado.

## Perguntas frequentes
**Posso mover vários negócios de uma vez?** Sim — selecione mais de um card e use a barra de ações em massa que aparece (mover etapa, definir dono, marcar Ganho/Perdido, etc).`,
  },
  {
    categorySlug: null,
    slug: "pp-atendente-3-criar-negocio",
    title: "Criando seu primeiro negócio",
    track: "primeiros_passos_atendente",
    order: 3,
    content: `## O que é
Um negócio representa uma oportunidade de venda com um contato específico.

## Passo a passo
1. Clique em **"Negócio +"** no topo do kanban.
2. Escolha um contato já existente (busque por nome/telefone) ou crie um novo contato ali mesmo, sem sair do formulário.
3. Escolha a pipeline e a etapa inicial, e preencha valor/campos customizados/tags se fizer sentido.
4. Salve — o negócio aparece na coluna escolhida.

## Perguntas frequentes
**E se eu digitar um telefone/email que já existe em outro contato?** O sistema não cria duplicado — ele usa automaticamente o contato já cadastrado com aquele telefone/email.`,
  },
  {
    categorySlug: null,
    slug: "pp-atendente-4-atendimento",
    title: "Atendendo pelo WhatsApp e Instagram",
    track: "primeiros_passos_atendente",
    order: 4,
    content: `## O que é
A tela de **Atendimento** é sua caixa de entrada de mensagens — cada conversa é um contato num canal específico (WhatsApp ou Instagram); se o mesmo contato falar pelos dois canais, aparecem como duas conversas separadas.

## Passo a passo
1. Escolha uma conversa na lista à esquerda (dá pra filtrar por canal, dono, não lidas, grupo/individual).
2. Digite e envie texto (Enter envia, Shift+Enter quebra linha), ou anexe imagem/vídeo/documento/áudio (grave direto no microfone, ou cole com Ctrl+V).
3. Use o ícone de resposta pra citar uma mensagem específica, e a estrela pra favoritar.
4. O relógio no composer agenda o envio de uma mensagem pra uma data/hora futura.
5. No Instagram, só dá pra anexar imagem, vídeo e áudio — documento não é suportado pela plataforma.

## Perguntas frequentes
**Por que uma mensagem antiga não aparece junto com a nova, do mesmo contato?** Porque WhatsApp e Instagram do mesmo contato são conversas separadas de propósito — use o filtro de canal na lista pra achar a outra conversa dele.`,
  },
  {
    categorySlug: null,
    slug: "pp-atendente-5-tarefas",
    title: "Executando uma tarefa",
    track: "primeiros_passos_atendente",
    order: 5,
    content: `## O que é
Tarefas aparecem tanto dentro de um negócio quanto na lista global em **Tarefas** — podem ter sido criadas automaticamente (ao entrar numa etapa, por automação) ou manualmente.

## Passo a passo
1. Acesse **Tarefas** pra ver tudo que está pendente (o padrão mostra tarefas em aberto de todos os negócios que você tem acesso).
2. Tarefas do tipo mensagem/email já abrem o composer certo direto da lista; tarefas de agendamento abrem o diálogo de marcar reunião.
3. Depois de feita, marque a tarefa como concluída.

## Perguntas frequentes
**Preciso entrar no negócio pra fazer uma tarefa?** Não — a lista global em Tarefas já permite executar ou concluir sem abrir o negócio.`,
  },
  {
    categorySlug: null,
    slug: "pp-atendente-6-notificacoes",
    title: "Recebendo notificações",
    track: "primeiros_passos_atendente",
    order: 6,
    content: `## O que é
O sino no topo avisa sobre mensagens novas e tarefas vencidas.

## Passo a passo
1. Clique no sino pra ver a lista de notificações; um número vermelho indica quantas ainda não foram lidas.
2. Clique numa notificação pra ir direto pra conversa ou negócio relacionado.
3. Se quiser receber avisos mesmo com a aba em segundo plano, aceite a permissão de notificação do navegador quando o sistema perguntar (uma única vez).

## Perguntas frequentes
**Recebo notificação de mensagem mesmo já com a conversa aberta?** Sim, hoje o sistema notifica todo mundo com acesso ao canal, independente de quem já está olhando a conversa naquele momento.`,
  },

  // ---------- Referência: Atendimento ----------
  {
    categorySlug: "atendimento",
    slug: "atendimento-visao-geral",
    title: "Como funciona o Atendimento",
    track: "referencia",
    content: `## O que é
O Atendimento é a caixa de entrada de mensagens do CRM, unificando WhatsApp e Instagram Direct numa única tela.

## Conceito central: uma conversa é (contato, canal)
Um contato pode ter mais de uma conversa separada — por exemplo, WhatsApp e Instagram — e elas **nunca aparecem misturadas** na mesma thread, cada uma com seu próprio histórico. Isso é parecido com como um contato pode ter vários negócios ou várias notas de reunião: cada canal é um item independente na lista.

## Passo a passo
1. A lista à esquerda mostra uma linha por conversa (contato + canal), com prévia da última mensagem, horário e contador de não lidas.
2. Clique numa conversa pra abri-la; em telas pequenas, isso troca pra tela cheia da conversa (com um botão de voltar).
3. Ao abrir uma conversa sem escolher um canal específico, o sistema abre automaticamente a mais recentemente usada daquele contato.
4. Trocar o canal no seletor dentro da conversa **troca de conversa** (recarrega as mensagens daquele canal), não só o canal de envio.

## Perguntas frequentes
**O contador de não lidas é só meu ou de toda a equipe?** É compartilhado — é um inbox de equipe. Abrir qualquer conversa daquele contato marca **todas** as conversas dele como lidas (mesmo em canais diferentes), já que essa marca é por contato, não por canal.`,
  },
  {
    categorySlug: "atendimento",
    slug: "atendimento-envio-midia",
    title: "Enviar texto, mídia e áudio",
    track: "referencia",
    content: `## O que é
Além de texto, o composer do Atendimento aceita imagem, vídeo, documento e áudio gravado na hora.

## Passo a passo
1. Digite o texto e pressione Enter pra enviar (Shift+Enter quebra linha sem enviar).
2. Clique no clipe pra anexar um arquivo, ou cole uma imagem direto da área de transferência (Ctrl+V).
3. Clique no microfone pra gravar um áudio — grave, ouça e envie, ou descarte.
4. Use o ícone de emoji pra abrir o seletor, e o botão de "inserir parâmetro" pra colar valores já resolvidos (nome do contato, email, valor do negócio, campos customizados) direto no texto.
5. Pra responder uma mensagem específica, clique no ícone de resposta dela — a citação aparece acima do campo de digitação até você enviar ou cancelar.
6. Cada mensagem enviada mostra o status: um check (enviado), dois cinzas (entregue) ou dois azuis (lido); "Falhou" aparece em vermelho se o envio não deu certo.

## Perguntas frequentes
**Por que não consigo mandar um PDF numa conversa do Instagram?** O Instagram Messaging só aceita imagem, vídeo e áudio como anexo — documento genérico não é suportado pela própria plataforma, não é uma limitação do CRM.`,
  },
  {
    categorySlug: "atendimento",
    slug: "atendimento-agendar-mensagem",
    title: "Agendar envio de mensagem",
    track: "referencia",
    content: `## O que é
Permite programar o envio automático de uma mensagem de texto pra uma data/hora futura, sem precisar lembrar de voltar na conversa.

## Passo a passo
1. Dentro de uma conversa (ou na página do negócio), clique no ícone de relógio.
2. Escolha o canal, escreva a mensagem e a data/hora de envio.
3. Confirme — a mensagem agendada aparece listada acima do composer até ser enviada.
4. No horário marcado, o sistema envia sozinho e grava a mensagem no histórico normalmente.

## Perguntas frequentes
**Funciona tanto pra WhatsApp quanto Instagram?** Sim, escolha o canal desejado na hora de agendar.`,
  },
  {
    categorySlug: "atendimento",
    slug: "atendimento-vincular-instagram",
    title: "Vincular ou mesclar um contato do Instagram",
    track: "referencia",
    content: `## O que é
Quando alguém manda uma mensagem pelo Instagram pela primeira vez, o CRM cria um contato novo automaticamente — mas só com o que o Instagram fornece (nome/@usuário do perfil), sem telefone nem email. Se essa pessoa já é um contato seu (ex: já tem WhatsApp cadastrado), você pode vincular os dois.

## Passo a passo
1. Abra a conversa do Instagram do contato criado automaticamente.
2. Clique em **"Vincular a contato existente"** no topo da conversa.
3. Busque o contato certo (ou um negócio aberto dele — escolher um negócio funde no contato dono dele) e confirme.
4. O sistema move todo o histórico (mensagens, negócios, tags) pro contato escolhido e apaga o registro duplicado do Instagram.

## Perguntas frequentes
**E se o contato de destino já tiver uma conta do Instagram vinculada?** O sistema recusa a vinculação nesse caso, pra não perder a identidade de nenhuma das duas contas — só um Instagram por contato.`,
  },
  {
    categorySlug: "atendimento",
    slug: "atendimento-filtros-exportar",
    title: "Filtros, favoritos e exportar conversa",
    track: "referencia",
    content: `## O que é
Ferramentas pra organizar e revisitar conversas.

## Passo a passo
1. Na lista de conversas, use o botão **Filtros** pra restringir por canal, dono (todos, meus atendimentos, não atribuídos, ou um atendente específico) e mostrar só não lidas; use as abas Todos/Individuais/Grupos pra separar conversas de grupo do WhatsApp.
2. Dentro de uma conversa, clique na estrela de uma mensagem pra favoritá-la; o switch **"Favoritas"** no topo filtra a conversa só pelas mensagens marcadas.
3. Clique em **"Exportar conversa (.md)"** pra baixar todo o histórico daquela conversa (só o canal aberto) em um arquivo de texto.

## Perguntas frequentes
**A exportação inclui todos os canais do contato?** Não — exporta só a conversa que está aberta no momento (um canal por vez), seguindo a mesma separação por canal do resto do Atendimento.`,
  },

  // ---------- Referência: Negócios ----------
  {
    categorySlug: "negocios",
    slug: "negocios-kanban",
    title: "Kanban de negócios: criar, mover e editar",
    track: "referencia",
    content: `## O que é
O quadro kanban em **Negócios** organiza as oportunidades por etapa da pipeline escolhida.

## Passo a passo
1. Escolha a pipeline no topo (cada uma tem suas próprias etapas/colunas).
2. Clique em **"Negócio +"** pra criar um novo — título é opcional (usa o nome do contato se ficar em branco), escolha ou crie o contato, pipeline, etapa, valor, dono, campos customizados e tags.
3. Mova um negócio arrastando o card pra outra coluna, ou pelo menu "..." → "Mover para..." — também dá pra mover pelo teclado (selecionar com Espaço, setas pra escolher a coluna, Enter confirma).
4. Toda movimentação mostra um aviso com opção de **Desfazer**.
5. Selecione vários cards pra usar ações em massa: mover etapa, definir dono, adicionar tag, marcar Ganho/Perdido, excluir.
6. Use os filtros (busca, status, dono, tag, temperatura, data de criação) pra restringir o que aparece no quadro.

## Perguntas frequentes
**Por que o quadro mostra só negócios "Abertos" por padrão?** Pra manter o foco no que ainda está em andamento — troque o filtro de status pra ver Ganhos, Perdidos ou Todos.`,
  },
  {
    categorySlug: "negocios",
    slug: "negocios-ganho-perdido",
    title: "Marcar Ganho, Perdido e reabrir",
    track: "referencia",
    content: `## O que é
Como encerrar (ou reabrir) um negócio.

## Passo a passo
1. Dentro do negócio, use os botões de status pra marcar como **Ganho** ou **Perdido**.
2. Marcar como Perdido exige escolher um **motivo de perda** (cadastrado em [Configurações → Pipelines](/configuracoes/pipelines), por pipeline).
3. As duas ações cancelam automaticamente qualquer sequência de automação em andamento pra aquele negócio, e disparam o webhook de saída correspondente, se configurado.
4. Se precisar, use **Reabrir** pra voltar o negócio pro status aberto (limpa data e motivo de perda/ganho).

## Perguntas frequentes
**Marcar Ganho dispara alguma coisa automaticamente?** Sim, se a pesquisa de NPS estiver configurada pra disparar em "negócio ganho" (ver [Como funciona a pesquisa de NPS pós-venda](/ajuda/pos-venda-nps/nps-como-funciona)).`,
  },
  {
    categorySlug: "negocios",
    slug: "negocios-card-completo",
    title: "Tarefas, reuniões, email e histórico dentro do negócio",
    track: "referencia",
    content: `## O que é
A página de detalhe do negócio reúne tudo relacionado àquela oportunidade.

## O que tem lá
- **Tarefas**: automáticas (criadas ao entrar numa etapa) e manuais, com execução direta (enviar mensagem/email, marcar como concluída, abrir agendamento).
- **Agendar reunião**: cria um evento de verdade no Google Agenda, convidando o contato automaticamente se ele tiver email cadastrado (exige ter conectado sua Google Agenda em [Perfil](/perfil) ou [Configurações → Google Agenda](/configuracoes/google-agenda)).
- **Agendar mensagem**: mesmo recurso do Atendimento, disponível direto no negócio.
- **Enviar email**: compõe e manda email pro contato usando templates pré-cadastrados, com anexos — fica registrado na lista de "Emails enviados" do negócio.
- **Resumo de Reuniões**: notas do Google Meet (via Gemini) sincronizadas automaticamente quando o contato participou de uma reunião pelo Google Agenda.
- **Histórico de conversa**: mensagens de todos os canais daquele contato, mescladas (diferente do Atendimento, que separa por canal) — com exportação em \`.md\`.
- **Histórico de alterações**: linha do tempo de tudo que aconteceu no negócio (criação, edições campo a campo, mudança de etapa, tags, ganho/perdido), mostrando se a mudança veio de um usuário, automação, webhook ou API.

## Perguntas frequentes
**Por que o histórico de conversa aqui mistura os canais, se no Atendimento não mistura?** Porque aqui é uma referência de leitura rápida do relacionamento com o contato; o Atendimento é a ferramenta de trabalho do dia a dia, por isso separa por canal.`,
  },
  {
    categorySlug: "negocios",
    slug: "negocios-dono-distribuicao",
    title: "Dono do negócio e distribuição automática",
    track: "referencia",
    content: `## O que é
Cada negócio pode ter um dono (o atendente responsável). Se ninguém escolher um dono na criação, o sistema pode distribuir automaticamente, se configurado.

## Passo a passo
1. Configure a distribuição em [Configurações → Pipelines](/configuracoes/pipelines) → [pipeline] → Distribuição de donos: adicione usuários com um peso cada (o sistema usa isso como uma proporção — quem tem peso maior recebe mais negócios).
2. Sem nenhuma regra configurada ali, negócios criados sem dono explícito continuam sem dono, como sempre.
3. Ao definir/alterar o dono de um negócio manualmente, esse dono é propagado pro contato vinculado também — mas nunca apaga um dono que o contato já tinha se a nova atribuição vier vazia.

## Perguntas frequentes
**A distribuição funciona pra negócios criados por importação de CSV ou webhook de entrada, não só manualmente?** Sim — qualquer negócio criado sem dono explícito passa pela mesma regra de distribuição da pipeline.`,
  },

  // ---------- Referência: Contatos ----------
  {
    categorySlug: "contatos",
    slug: "contatos-cadastro",
    title: "Cadastrar e editar contatos",
    track: "referencia",
    content: `## O que é
A tela de **Contatos** é o CRUD central de pessoas/empresas com quem sua equipe fala.

## Passo a passo
1. Use a busca (nome, telefone ou email) pra achar um contato na lista.
2. Clique em **Novo contato**: nome e telefone são obrigatórios, email é opcional; preencha também campos customizados e tags.
3. Pra editar, abra o contato (ou use o botão Editar na lista) e altere o que precisar.
4. A exclusão só é permitida se o contato **não tiver nenhum negócio vinculado** — mova ou exclua os negócios primeiro.

## Perguntas frequentes
**Um contato pode não ter telefone?** Sim, contatos que chegam só pelo Instagram não têm telefone até serem vinculados a um contato com WhatsApp (ver [Evitar e resolver contatos duplicados](/ajuda/contatos/contatos-duplicados)).`,
  },
  {
    categorySlug: "contatos",
    slug: "contatos-duplicados",
    title: "Evitar e resolver contatos duplicados",
    track: "referencia",
    content: `## O que é
O sistema nunca permite dois contatos com o mesmo telefone ou email — telefone tem prioridade como identidade mais forte.

## Passo a passo
1. **Ao criar** um contato (direto ou pelo formulário de negócio) com telefone/email já usado por outro contato: o sistema **não cria** um novo — avisa e oferece ver/usar o contato já existente.
2. **Ao editar** um contato pra um telefone/email que já pertence a outro: o sistema oferece **"Mesclar e salvar"** — os dois contatos são fundidos (histórico de mensagens, negócios, tags, agendamentos, emails, notificações e NPS movidos pro contato que você está editando).
3. Se um contato duplicado já existia antes dessa proteção (ou surgiu por outro motivo), aparece um **aviso de possível duplicata** no card do contato, no negócio, no cabeçalho do Atendimento e na lista de contatos (ícone de alerta ao lado do nome) — com botão pra mesclar ou ignorar o aviso.
4. Importação por CSV segue a mesma regra: telefone/email já cadastrado atualiza o contato existente e cria só um negócio novo pra ele, nunca duplica o contato.

## Perguntas frequentes
**Mesclar apaga alguma informação?** Só o registro duplicado em si é removido; os dados de identidade (foto, Instagram vinculado, campos customizados) que o contato de destino ainda não tinha são preenchidos a partir do duplicado — nada que já existia no destino é sobrescrito.`,
  },

  // ---------- Referência: Tarefas e Automação ----------
  {
    categorySlug: "tarefas-automacao",
    slug: "tarefas-lista-global",
    title: "Lista global de tarefas",
    track: "referencia",
    content: `## O que é
Em **Tarefas**, você vê todas as tarefas de todos os negócios num lugar só, sem precisar entrar em cada um.

## Passo a passo
1. Use os filtros de status (Em aberto, Atrasadas, Concluídas, Todas), dono, tipo de tarefa, pipeline e intervalo de prazo.
2. A lista prioriza tarefas atrasadas, depois por prazo mais próximo.
3. Execute a tarefa direto da lista (enviar mensagem/email, abrir agendamento) ou marque como concluída.

## Perguntas frequentes
**A lista mostra tarefas de negócios que não são meus?** Depende do seu nível de acesso — se você tiver a restrição "aos próprios negócios" ativada (ver [Cadastrar usuários e permissões](/ajuda/config-usuarios/config-usuarios-cadastro)), só vê as suas.`,
  },
  {
    categorySlug: "tarefas-automacao",
    slug: "automacao-tres-camadas",
    title: "As 3 camadas de automação: tarefa de etapa, automação por tag e sequência",
    track: "referencia",
    content: `## O que é
O CRM tem três formas distintas de automatizar tarefas, cada uma com seu propósito — entender a diferença evita configurar a coisa errada no lugar errado.

## As três camadas
1. **Tarefa automática de etapa** (dentro de [Configurações → Pipelines](/configuracoes/pipelines) → etapa): dispara quando um negócio **entra** naquela etapa. É a mais simples — um passo só, ligado à posição no funil.
2. **Automações** ([Configurações → Automações](/configuracoes/automacoes)): disparam por **tag** — quando uma tag é adicionada a um negócio, ou depois de X tempo com aquela tag. Também um passo só, mas o gatilho é a tag, não a etapa.
3. **Sequências** ([Configurações → Sequências](/configuracoes/sequencias)): a mais sofisticada — vários passos encadeados no tempo (mensagem, tarefa genérica, adicionar tag, mudar de etapa), disparados por entrada em etapa, tag ganha, ou **falta de resposta do contato há N dias**, com uma condição opcional sobre o negócio (temperatura, tag, campo customizado).

## Perguntas frequentes
**Uso automação por tag ou sequência pra um lembrete simples?** Se for um passo só, automação por tag basta. Se envolver vários passos espaçados no tempo (ex: mensagem no dia 1, outra no dia 3, tarefa no dia 7), use Sequências.`,
  },

  // ---------- Referência: Reuniões e Google Agenda ----------
  {
    categorySlug: "reunioes-agenda",
    slug: "google-agenda-conectar",
    title: "Conectar sua Google Agenda e compartilhar",
    track: "referencia",
    content: `## O que é
Cada usuário (admin ou atendente) conecta a própria conta do Google Agenda — é uma conexão pessoal, não uma configuração única da empresa, mesmo estando dentro de Configurações.

## Passo a passo
1. Acesse [Perfil](/perfil) (ou [Configurações → Google Agenda](/configuracoes/google-agenda), se for admin) e clique em conectar.
2. Autorize o acesso na tela do Google.
3. Se quiser deixar outros atendentes agendarem reuniões usando sua agenda sem precisar conectar a própria conta, ative o compartilhamento pra eles ali mesmo.
4. Um atendente sem conexão própria, mas com uma agenda compartilhada por um colega, vê o aviso "Você está usando a agenda compartilhada por [nome]".

## Perguntas frequentes
**Preciso reconectar se trocar de senha do Google?** Normalmente não, a menos que você revogue o acesso manualmente na conta Google — nesse caso, reconecte pelo mesmo botão.`,
  },
  {
    categorySlug: "reunioes-agenda",
    slug: "reunioes-notas-gemini",
    title: "Agendar reunião e notas automáticas do Gemini",
    track: "referencia",
    content: `## O que é
Dentro de um negócio, dá pra marcar uma reunião de verdade no Google Agenda, e depois que ela acontece (se gravada com o Gemini no Google Meet), o resumo aparece automaticamente no CRM.

## Passo a passo
1. No negócio, clique em **"Agendar reunião"** — exige ter Google Agenda conectada e o contato ter email cadastrado (senão, o sistema oferece um link simples de "adicionar ao Google Agenda" como alternativa).
2. O evento é criado convidando o contato automaticamente.
3. Se a reunião for feita no Google Meet com "Tomar notas com o Gemini" ativado, o resumo, os itens de ação e a transcrição completa aparecem sozinhos no card **"Resumo de Reuniões"** do negócio (e do contato) depois que o Google gera o documento.

## Perguntas frequentes
**E se o formato do documento de notas não for reconhecido?** O card mostra um aviso de "formato não reconhecido automaticamente", mas ainda disponibiliza o link pra abrir o documento original no Drive.`,
  },

  // ---------- Referência: Email ----------
  {
    categorySlug: "email",
    slug: "email-enviar",
    title: "Enviar email a partir de um negócio",
    track: "referencia",
    content: `## O que é
Diferente de WhatsApp/Instagram, email não é um canal de atendimento com caixa de entrada — é só envio, registrado no histórico do negócio.

## Passo a passo
1. Dentro do negócio, clique em **"Enviar email"**.
2. Escolha um template pré-cadastrado (preenche assunto/corpo automaticamente) ou escreva do zero, e anexe arquivos se precisar.
3. Envie — o email aparece na lista "Emails enviados" do negócio, com status (enviado ou falhou).

## Perguntas frequentes
**Preciso configurar algo antes de usar isso?** Sim, um admin precisa configurar o remetente em [Configurações → Email](/configuracoes/email) (endereço, provedor e chave de API) antes de qualquer email poder ser enviado.`,
  },

  // ---------- Referência: NPS ----------
  {
    categorySlug: "pos-venda-nps",
    slug: "nps-como-funciona",
    title: "Como funciona a pesquisa de NPS pós-venda",
    track: "referencia",
    content: `## O que é
Uma pesquisa automática de satisfação (nota de 0 a 10) enviada por WhatsApp depois que um negócio é ganho e/ou entra numa etapa configurada.

## Passo a passo
1. Um admin configura o gatilho em [Configurações → NPS](/configuracoes/nps) (ao ganhar e/ou ao entrar em etapa X), o prazo em dias, o canal e o template de envio.
2. Quando um negócio se torna elegível, o sistema gera um link único e manda a mensagem automaticamente.
3. O cliente responde num link público, sem precisar de login — escolhe uma nota e pode deixar um comentário.
4. Cada link só pode ser respondido uma vez.
5. Se a nota for baixa (0 a 6, "detrator"), o sistema cria automaticamente uma tarefa de follow-up no negócio, pra alguém da equipe entrar em contato.

## Perguntas frequentes
**Onde vejo o resultado das pesquisas?** No card "NPS pós-venda" da [tela Início](/) (nota média, distribuição por faixa e comentários recentes) — a tela de [Configurações → NPS](/configuracoes/nps) só cuida do disparo, não mostra resultado.`,
  },

  // ---------- Referência: Notificações ----------
  {
    categorySlug: "notificacoes",
    slug: "notificacoes-tipos",
    title: "Tipos de notificação e como funcionam",
    track: "referencia",
    content: `## O que é
O sino no cabeçalho avisa sobre eventos importantes, sem precisar ficar checando as telas manualmente.

## Tipos existentes hoje
- **Mensagem nova**: disparada quando chega uma mensagem (WhatsApp ou Instagram) pra todo mundo com acesso àquele canal — mesmo que a pessoa já esteja com a conversa aberta.
- **Tarefa vencida**: uma varredura periódica avisa o dono do negócio quando uma tarefa passa do prazo, sem repetir o aviso pra mesma tarefa.

## Passo a passo
1. Clique no sino pra ver a lista; use "Marcar todas como lidas" pra limpar o contador.
2. Clique numa notificação pra ir direto pra conversa (mensagem nova) ou pro negócio (demais tipos).
3. Aceite a permissão do navegador (perguntada de forma discreta, uma vez) pra também receber aviso mesmo com a aba em segundo plano.

## Perguntas frequentes
**Recebo notificação de mensagem se eu já estiver com a conversa aberta na tela?** Sim, hoje o sistema não distingue isso — toda mensagem nova notifica todo mundo com acesso ao canal.`,
  },

  // ---------- Referência: Dashboard ----------
  {
    categorySlug: "dashboard",
    slug: "dashboard-indicadores",
    title: "Indicadores do Painel Início",
    track: "referencia",
    content: `## O que é
A tela **Início** reúne os principais indicadores comerciais do time, com filtro de período, pipeline e tag.

## O que tem lá
- Leads, reuniões realizadas (+ conversão), Ganho x Perdido, valor total vendido, atividades, mensagens enviadas, ciclo médio de venda, ticket médio e tempo médio até a primeira resposta — todos calculados sobre o período/filtro escolhido.
- **Funil por etapa** e **NPS pós-venda**: mostram sempre o estado atual, independente do filtro de período escolhido.
- **Ranking por vendedor**, **mensagens por dia** (gráfico dos últimos 90 dias) e **motivos de perda** mais comuns.

## Perguntas frequentes
**Por que o funil não muda quando troco o período?** Porque ele reflete a posição atual dos negócios abertos, não um recorte histórico — trocar o período só afeta os indicadores que fazem sentido "por período" (leads, vendas, etc).

**Tem indicadores de LinkedIn/LeadDelta aqui também?** Não — esse é um painel separado, veja [Painel de indicadores do LinkedIn via LeadDelta](/ajuda/linkedin/linkedin-leaddelta).`,
  },

  // ---------- Referência: LinkedIn ----------
  {
    categorySlug: "linkedin",
    slug: "linkedin-leaddelta",
    title: "Painel de indicadores do LinkedIn via LeadDelta",
    track: "referencia",
    content: `## O que é
Não é um canal de atendimento — é um painel de indicadores sobre as conexões do LinkedIn sincronizadas de uma ferramenta terceirizada chamada **LeadDelta** (configurada em [Configurações → LinkedIn](/configuracoes/linkedin)).

## Passo a passo
1. Configure a API Key do LeadDelta em [Configurações → LinkedIn](/configuracoes/linkedin) e sincronize — lá também tem o botão **"Sincronizar agora"** pra atualizar na hora, sem esperar o horário do cron diário.
2. Acesse [LinkedIn](/linkedin) no menu pra ver o funil de prospecção (Entrada → Contato realizado → Reunião → Fechado), comparativo entre os dois perfis/contas de prospecção usados, e uma tabela filtrável de todas as conexões individuais.
3. Clique em **"Ver mais indicadores"** pra detalhes extras: cidades, empresas mais frequentes, novas conexões por mês, distribuição por workspace.

## Perguntas frequentes
**Dá pra mandar mensagem pelo LinkedIn direto do CRM?** Não — essa tela é só leitura de indicadores; envio de mensagem continua sendo feito direto no LinkedIn/LeadDelta.`,
  },

  // ---------- Referência: Configurações — Usuários ----------
  {
    categorySlug: "config-usuarios",
    slug: "config-usuarios-cadastro",
    title: "Cadastrar usuários e permissões",
    track: "referencia",
    roleVisibility: "admin",
    content: `## O que é
Gestão de quem acessa o CRM e com qual nível de permissão.

## Passo a passo
1. Em [Configurações → Usuários](/configuracoes/usuarios), crie um usuário com nome, email e papel (Atendente ou Admin) — a senha temporária gerada só aparece uma vez.
2. Edite um usuário pra trocar nome/email/papel, ou ativar **"Restringir aos próprios negócios/atendimentos"** (o atendente só vê o que é dele ou sem dono).
3. Exclua um usuário que não precisa mais de acesso.

## Perguntas frequentes
**Posso rebaixar minha própria conta de admin?** Não — o sistema bloqueia isso, e também bloqueia rebaixar ou excluir o último admin do sistema, pra nunca ficar sem acesso às Configurações.`,
  },

  // ---------- Referência: Configurações — Pipelines ----------
  {
    categorySlug: "config-pipelines",
    slug: "config-pipelines-etapas",
    title: "Criar e organizar pipelines e etapas",
    track: "referencia",
    roleVisibility: "admin",
    content: `## O que é
Estrutura o funil de vendas: pipelines (funis) e suas etapas (colunas do kanban).

## Passo a passo
1. Em [Configurações → Pipelines](/configuracoes/pipelines), crie uma pipeline nova ou clone uma existente (copia etapas, tarefas automáticas e motivos de perda com nome novo).
2. Dentro da pipeline, crie etapas (nome + cor) e reordene por drag-and-drop ou pelas setas.
3. Em cada etapa, configure a tarefa automática que é criada quando um negócio entra ali (tipo, template, prazo, atraso de disparo, e opção de enviar mensagem sozinha sem clique).

## Perguntas frequentes
**Posso excluir uma pipeline ou etapa com negócios dentro?** Não — a exclusão é bloqueada enquanto houver qualquer negócio nela, pra evitar perda de dados por engano; mova ou exclua os negócios primeiro.`,
  },
  {
    categorySlug: "config-pipelines",
    slug: "config-motivos-perda",
    title: "Motivos de perda",
    track: "referencia",
    roleVisibility: "admin",
    content: `## O que é
Lista de motivos (texto livre) que ficam disponíveis quando um negócio daquela pipeline é marcado como Perdido.

## Passo a passo
1. Dentro da pipeline, acesse o painel de Motivos de perda.
2. Adicione, reordene ou exclua motivos.

## Perguntas frequentes
**Motivos de perda são compartilhados entre pipelines?** Não — cada pipeline tem sua própria lista, cadastrada separadamente (embora clonar uma pipeline copie os motivos junto).`,
  },
  {
    categorySlug: "config-pipelines",
    slug: "config-distribuicao-donos",
    title: "Distribuição automática de donos",
    track: "referencia",
    roleVisibility: "admin",
    content: `## O que é
Define quem recebe automaticamente negócios criados sem dono explícito, numa pipeline específica.

## Passo a passo
1. Dentro da pipeline, acesse o painel de Distribuição de donos.
2. Adicione usuários com um peso cada — o sistema calcula o % de cada um (peso dividido pela soma dos pesos) e mostra quantos negócios cada um já recebeu.
3. Sem nenhum usuário cadastrado aqui, negócios sem dono explícito continuam sem dono, como o comportamento padrão do sistema.

## Perguntas frequentes
**Isso vale só pra negócios criados manualmente?** Não — vale pra qualquer negócio criado sem dono explícito, incluindo os vindos de webhook de entrada e importação de CSV.`,
  },

  // ---------- Referência: Configurações — Campos e Tags ----------
  {
    categorySlug: "config-campos-tags",
    slug: "config-campos-customizados",
    title: "Campos customizados",
    track: "referencia",
    roleVisibility: "admin",
    content: `## O que é
Campos extras (além dos padrões do sistema) pra Contatos ou Negócios, guardados como informação livre em cada registro.

## Passo a passo
1. Em [Configurações → Campos Customizados](/configuracoes/campos), escolha a entidade (Contato ou Negócio), o rótulo, e o tipo: Texto, Número, Select (com opções cadastradas) ou Data.
2. Depois de criado, só o rótulo e as opções (se for Select) podem ser editados — entidade, chave técnica e tipo ficam travados.
3. Reordene os campos arrastando; a tela mostra quantos registros já têm aquele campo preenchido.

## Perguntas frequentes
**Campos customizados viram variável de template automaticamente?** Sim, sem nenhuma configuração extra — assim que criado, já aparece disponível pra usar em Templates.`,
  },
  {
    categorySlug: "config-campos-tags",
    slug: "config-tags",
    title: "Tags",
    track: "referencia",
    roleVisibility: "admin",
    content: `## O que é
Etiquetas coloridas aplicáveis a contatos e negócios, usadas pra classificar e filtrar, e também como gatilho de automações.

## Passo a passo
1. Em [Configurações → Tags](/configuracoes/tags), crie uma tag com nome (não pode repetir, mesmo com maiúsculas/minúsculas diferentes) e cor.
2. Edite ou exclua conforme necessário — a tela mostra quantos contatos/negócios usam cada tag.
3. Reordene arrastando.

## Perguntas frequentes
**Excluir uma tag remove ela dos negócios/contatos que a usam?** Sim, automaticamente — os vínculos somem junto (a contagem de uso mostrada antes de excluir já serve de aviso).`,
  },

  // ---------- Referência: Configurações — Templates ----------
  {
    categorySlug: "config-templates",
    slug: "config-templates-mensagem-email",
    title: "Templates de mensagem e email",
    track: "referencia",
    roleVisibility: "admin",
    content: `## O que é
Textos reutilizáveis com variáveis, usados por tarefas automáticas, automações, sequências e envio de NPS.

## Passo a passo
1. Em [Configurações → Templates](/configuracoes/templates), crie um template de mensagem (nome + conteúdo) ou de email (nome + assunto + corpo).
2. Use o painel de variáveis disponíveis (clicáveis) pra inserir no texto — inclui nome/email do contato, valor do negócio e qualquer campo customizado já cadastrado.
3. Veja o preview ao vivo com dados de exemplo antes de salvar.
4. Ao excluir um template em uso, as tarefas automáticas que o referenciavam ficam sem template (não são bloqueadas, só desvinculadas).

## Perguntas frequentes
**O template de NPS também é cadastrado aqui?** Sim, é um template de mensagem normal — só precisa conter a variável \`{{link_pesquisa}}\` pra funcionar (configurado em [Configurações → NPS](/configuracoes/nps)).`,
  },

  // ---------- Referência: Configurações — Canais ----------
  {
    categorySlug: "config-canais",
    slug: "config-whatsapp",
    title: "Conectar e configurar um canal WhatsApp",
    track: "referencia",
    roleVisibility: "admin",
    content: `## O que é
Cada canal WhatsApp conecta um número de telefone via Z-API (provedor terceirizado).

## Passo a passo
1. Em [Configurações → WhatsApp](/configuracoes/whatsapp), adicione um canal com nome, Instance ID, Token e Client-Token da Z-API.
2. Copie a URL de webhook exibida e cadastre no painel da Z-API (abas "Ao receber" e "Status da mensagem").
3. Clique em **"Testar conexão"** pra validar — isso também corrige automaticamente uma configuração incompleta de notificação de mensagens enviadas de outro aparelho, sem precisar reconectar.
4. Marque um canal como **padrão**, se tiver mais de um.
5. No detalhe do canal: copie a URL de repasse (se outro sistema também usa a mesma instância Z-API, cole a URL dele aqui pra receber cópia dos eventos), e controle quais atendentes têm acesso bloqueado a esse canal específico (por padrão, todos têm acesso).

## Perguntas frequentes
**Por que preciso de uma URL de "repasse pra outro sistema"?** Porque a Z-API só aceita uma URL de webhook cadastrada por evento — se outro sistema também depende dessa mesma instância, o CRM repassa uma cópia de cada evento recebido pra lá, sem interferir no processamento normal.`,
  },
  {
    categorySlug: "config-canais",
    slug: "config-instagram",
    title: "Conectar e configurar uma conta do Instagram",
    track: "referencia",
    roleVisibility: "admin",
    content: `## O que é
Conexão de uma conta profissional do Instagram (Business ou Criador de conteúdo) pra atendimento via Direct.

## Passo a passo
1. Em [Configurações → Instagram](/configuracoes/instagram), clique em **"Conectar conta do Instagram"** — isso abre o fluxo de autorização do próprio Meta, sem precisar digitar nenhuma credencial manualmente.
2. A conta precisa estar cadastrada como testadora do app usado pelo CRM (enquanto o app não passar por revisão do Meta) — **não precisa** de Página do Facebook vinculada.
3. Depois de conectado, use **"Testar conexão"** sempre que quiser confirmar que está tudo certo (reforça a inscrição em webhook automaticamente).
4. Controle o acesso por atendente do mesmo jeito do WhatsApp (bloqueio, não permissão — por padrão todos têm acesso).

## Perguntas frequentes
**Por que meu teste de mensagem não aparece no CRM mesmo com tudo conectado?** Enquanto o app do Meta não passa por revisão, só interações entre contas cadastradas como testadoras do app funcionam — mensagens de clientes reais só passam a chegar depois da aprovação do Meta.`,
  },

  // ---------- Referência: Configurações — Webhooks ----------
  {
    categorySlug: "config-webhooks",
    slug: "config-webhooks-entrada",
    title: "Webhook de entrada: capturar leads externos",
    track: "referencia",
    roleVisibility: "admin",
    content: `## O que é
Recebe dados de ferramentas externas (landing pages, calculadoras, formulários) e cria contato + negócio automaticamente.

## Passo a passo
1. Em [Configurações → Webhooks](/configuracoes/webhooks), crie um webhook de entrada com nome, pipeline e etapa padrão.
2. Copie a URL e o **token secreto** gerado (mostrado uma única vez) — a ferramenta externa precisa mandar esse token no header \`x-webhook-secret\` ou como \`?token=\`.
3. Configure o **mapeamento de campos**: pra cada campo do sistema ou customizado, informe o caminho dentro do JSON recebido (ex: \`payload.nome\`).
4. Cadastre **tags fixas** que todo registro criado por esse webhook recebe automaticamente, pra identificar a origem depois.
5. Use **"Enviar payload de teste"** com um JSON de exemplo pra conferir se o mapeamento está funcionando antes de ativar de vez.
6. Acompanhe as execuções na aba de logs.

## Perguntas frequentes
**Um teste de payload conta como execução de verdade?** Sim, ele roda o processamento real (cria contato/negócio de verdade) e fica registrado no log — não é uma simulação.`,
  },
  {
    categorySlug: "config-webhooks",
    slug: "config-webhooks-saida",
    title: "Webhook de saída: notificar outro sistema",
    track: "referencia",
    roleVisibility: "admin",
    content: `## O que é
Dispara um POST pra uma URL externa quando eventos escolhidos acontecem no CRM.

## Passo a passo
1. Em [Configurações → Webhooks](/configuracoes/webhooks), crie um webhook de saída com nome e URL de destino.
2. Marque os eventos desejados: negócio criado, etapa alterada, negócio ganho, negócio perdido.
3. Se quiser, filtre por pipeline (e, só pro evento "Etapa alterada", por uma etapa específica).

## Perguntas frequentes
**O filtro de etapa vale pra todos os eventos marcados?** Não — só se aplica ao evento "Etapa alterada"; os demais eventos (criado, ganho, perdido) disparam independente desse filtro.`,
  },

  // ---------- Referência: Configurações — Importação ----------
  {
    categorySlug: "config-importacao",
    slug: "config-importacao-csv",
    title: "Importar contatos e negócios via CSV",
    track: "referencia",
    roleVisibility: "admin",
    content: `## O que é
Wizard de importação em massa de contatos e negócios a partir de uma planilha CSV.

## Passo a passo
1. Em [Configurações → Importação](/configuracoes/importacao), envie o arquivo \`.csv\` (se os acentos vierem errados, use "Tentar reler como Windows-1252 (Excel)").
2. Mapeie cada coluna da planilha pra um campo do sistema, campo customizado, ou "Não mapear".
3. Escolha o destino: uma pipeline/etapa fixa pra todas as linhas, ou por coluna (mapeando cada valor distinto da planilha pra uma etapa real).
4. Confira o preview das primeiras linhas já resolvidas.
5. Execute — o sistema processa em lotes e mostra o progresso, com um relatório final de criados/atualizados/erros.

## Perguntas frequentes
**Se eu rodar a mesma planilha duas vezes, duplica tudo?** **Negócios sempre são criados novos por linha** — rodar o mesmo arquivo de novo duplica os negócios. Já **contatos são deduplicados por telefone/email**: se já existir, o contato é atualizado, não duplicado. Tome cuidado especial com negócios ao reimportar um arquivo.`,
  },

  // ---------- Referência: Configurações — Negócio Automático ----------
  {
    categorySlug: "config-negocio-automatico",
    slug: "config-negocio-automatico",
    title: "Criar negócio automaticamente na primeira mensagem",
    track: "referencia",
    roleVisibility: "admin",
    content: `## O que é
Configuração única que, quando ativa, cria um negócio sozinho assim que chega a primeira mensagem de um contato novo (WhatsApp ou Instagram), sem negócio aberto ainda.

## Passo a passo
1. Em [Configurações → Negócio Automático](/configuracoes/negocio-automatico), ative o switch.
2. Escolha a pipeline e a etapa fixa onde esses negócios devem entrar.

## Perguntas frequentes
**Isso cria negócio pra qualquer mensagem, mesmo de um contato que já tem negócio aberto?** Não — só dispara se o contato ainda não tiver nenhum negócio aberto, não for uma conversa em grupo, e a mensagem não tenha sido enviada pelo próprio atendente (fromMe).`,
  },

  // ---------- Referência: Configurações — API/MCP ----------
  {
    categorySlug: "config-api",
    slug: "config-api-chaves",
    title: "Chaves de API: escopo operacional e admin",
    track: "referencia",
    roleVisibility: "admin",
    content: `## O que é
Chaves de API permitem que sistemas externos ou agentes de IA acessem o CRM via API REST ou servidor MCP.

## Passo a passo
1. Em [Configurações → API](/configuracoes/api), crie uma chave com um rótulo e escolha o escopo: **Operacional** (negócios, contatos, tarefas, mensagens e emails do dia a dia) ou **Admin** (tudo do operacional + configurar o CRM: pipelines, campos, tags, templates, automações, webhooks).
2. A chave gerada (\`rawKey\`) só aparece **uma única vez**, na criação — copie e guarde com segurança.
3. Revogue ou reative uma chave existente quando precisar, sem excluir o registro (mantém o histórico de uso).

## Perguntas frequentes
**O escopo da chave depende do papel de quem criou?** Não — é uma permissão independente do usuário: mesmo um admin pode criar uma chave só "Operacional", que nunca conseguirá mexer em configuração do CRM.`,
  },
  {
    categorySlug: "config-api",
    slug: "config-api-mcp",
    title: "Conectar o CRM a um agente de IA via MCP",
    track: "referencia",
    roleVisibility: "admin",
    content: `## O que é
O CRM expõe um servidor MCP (Model Context Protocol), permitindo que um assistente de IA (Claude, por exemplo) consulte e opere o CRM diretamente.

## Passo a passo
1. No claude.ai, em Configurações → Conectores → Adicionar conector personalizado, cole só a URL do servidor (ver [Configurações → API → Documentação MCP](/configuracoes/api/mcp)) e deixe os campos de OAuth em branco — o claude.ai se registra sozinho e abre uma tela de consentimento dentro do próprio CRM, onde você loga como admin e escolhe o escopo; a API key é criada automaticamente nesse momento.
2. Se o seu cliente MCP só suporta servidores locais (stdio), crie uma chave manualmente (ver [Chaves de API: escopo operacional e admin](/ajuda/config-api/config-api-chaves)) e configure a ponte \`mcp-remote\` com a chave no header \`Authorization: Bearer\` — sem passar pelo fluxo OAuth.
3. Com escopo Operacional, o agente já consegue listar/detalhar negócios e contatos, mexer no histórico de conversa, mover etapa, gerenciar tags e tarefas, e enviar mensagem/email.
4. Com escopo Admin, o agente também consegue mexer em configuração do CRM (pipelines, campos, tags, templates, automações, webhooks) — nunca em credenciais de canal, mesmo com esse escopo.

## Perguntas frequentes
**Um agente conectado via MCP também consegue buscar artigos desta Central de Ajuda?** Sim — as ferramentas de busca e consulta de artigos de ajuda estão disponíveis em qualquer escopo de chave, já que é conteúdo de ajuda, não dado sensível.`,
  },
];

async function main() {
  await db.delete(helpArticles);
  await db.delete(helpCategories);

  const categoryIdBySlug = new Map<string, string>();
  for (const cat of categories) {
    const [row] = await db
      .insert(helpCategories)
      .values(cat)
      .returning({ id: helpCategories.id });
    categoryIdBySlug.set(cat.slug, row.id);
  }

  for (const art of articles) {
    await db.insert(helpArticles).values({
      categoryId: art.categorySlug ? (categoryIdBySlug.get(art.categorySlug) ?? null) : null,
      title: art.title,
      slug: art.slug,
      content: art.content,
      track: art.track,
      order: art.order ?? null,
      roleVisibility: art.roleVisibility ?? "todos",
    });
  }

  console.log(`Seed concluído: ${categories.length} categorias, ${articles.length} artigos.`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Erro ao popular a Central de Ajuda:", error);
    process.exit(1);
  });

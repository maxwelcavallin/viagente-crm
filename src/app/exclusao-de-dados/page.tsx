// Página pública, sem AppShell nem auth() — exigida pelo processo de
// publicação do app no Meta ("Exclusão de dados do usuário"). Instruções
// manuais (não um callback automatizado) — suficiente pra publicação do
// app, ver docs.developers.facebook.com sobre as duas formas aceitas.
export const metadata = {
  title: "Exclusão de dados — CRM Viagente",
};

export default function DataDeletionPage() {
  return (
    <main className="mx-auto max-w-2xl space-y-6 p-6 py-12">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-foreground">Exclusão de dados</h1>
        <p className="text-sm text-muted-foreground">Última atualização: 17 de julho de 2026.</p>
      </div>

      <p className="text-sm text-muted-foreground">
        Se você trocou mensagens com a Viagente pelo WhatsApp, Instagram Direct ou qualquer outro
        canal integrado ao nosso CRM, e quer solicitar a exclusão dos seus dados pessoais
        mantidos por nós, siga as instruções abaixo.
      </p>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Como solicitar</h2>
        <p className="text-sm text-muted-foreground">
          Envie um email para{" "}
          <a href="mailto:contato@viagt.com.br" className="text-primary hover:underline">
            contato@viagt.com.br
          </a>{" "}
          com o assunto &quot;Exclusão de dados&quot;, informando o telefone, @ do Instagram ou
          email usado no contato com a Viagente, pra que possamos localizar seu cadastro.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">O que é excluído</h2>
        <p className="text-sm text-muted-foreground">
          Nome, telefone, email, identificador de conta do Instagram, histórico de mensagens e
          quaisquer dados comerciais (negócios, tarefas, notas) associados ao seu cadastro no
          nosso CRM.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Prazo</h2>
        <p className="text-sm text-muted-foreground">
          Processamos solicitações de exclusão em até 30 dias corridos, e confirmamos por email
          quando concluído.
        </p>
      </section>

      <p className="text-sm text-muted-foreground">
        Mais detalhes sobre como tratamos dados pessoais estão na nossa{" "}
        <a href="/privacidade" className="text-primary hover:underline">
          Política de Privacidade
        </a>
        .
      </p>
    </main>
  );
}

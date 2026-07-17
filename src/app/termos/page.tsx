// Página pública, sem AppShell nem auth() — exigida pelo processo de
// publicação do app no Meta (URL de Termos de Serviço).
export const metadata = {
  title: "Termos de Serviço — CRM Viagente",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="space-y-2 text-sm text-muted-foreground">{children}</div>
    </section>
  );
}

export default function TermsOfServicePage() {
  return (
    <main className="mx-auto max-w-2xl space-y-8 p-6 py-12">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-foreground">Termos de Serviço</h1>
        <p className="text-sm text-muted-foreground">Última atualização: 17 de julho de 2026.</p>
      </div>

      <p className="text-sm text-muted-foreground">
        Este Sistema (&quot;o CRM Viagente&quot;) é uma ferramenta de uso interno da Viagente —
        Agência e Gestão de Viagens, desenvolvida para a própria equipe gerenciar o atendimento e
        o relacionamento comercial com clientes e leads. Não é um produto ou serviço oferecido a
        terceiros.
      </p>

      <Section title="1. Uso autorizado">
        <p>
          O acesso ao Sistema é restrito a colaboradores autorizados da Viagente, mediante login
          individual. Cada usuário é responsável pelo uso feito com suas credenciais e deve
          utilizá-las apenas para fins de atendimento e gestão comercial legítimos da empresa.
        </p>
      </Section>

      <Section title="2. Canais de comunicação integrados">
        <p>
          O Sistema se conecta a canais de mensageria (WhatsApp, Instagram Direct) e agenda
          (Google Agenda) em nome da Viagente, pra centralizar o atendimento a clientes e leads.
          O uso desses canais está sujeito também aos termos de uso das respectivas plataformas
          (Meta, Google).
        </p>
      </Section>

      <Section title="3. Dados tratados">
        <p>
          O tratamento de dados pessoais de clientes e leads dentro do Sistema segue o descrito na{" "}
          <a href="/privacidade" className="text-primary hover:underline">
            Política de Privacidade
          </a>
          .
        </p>
      </Section>

      <Section title="4. Disponibilidade e limitação de responsabilidade">
        <p>
          O Sistema é fornecido &quot;como está&quot;, sem garantia de disponibilidade
          ininterrupta. A Viagente não se responsabiliza por indisponibilidades causadas por
          provedores terceiros (Meta, Google, provedores de hospedagem/email) fora de seu
          controle direto.
        </p>
      </Section>

      <Section title="5. Alterações">
        <p>
          Estes termos podem ser atualizados conforme o Sistema evolui. A versão vigente é sempre
          a publicada nesta página.
        </p>
      </Section>

      <Section title="6. Contato">
        <p>
          Dúvidas sobre estes termos podem ser enviadas para{" "}
          <a href="mailto:contato@viagt.com.br" className="text-primary hover:underline">
            contato@viagt.com.br
          </a>
          .
        </p>
      </Section>
    </main>
  );
}

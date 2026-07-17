// Página pública, sem AppShell nem auth() — exigida pelo processo de
// publicação do app no Meta (URL de Política de Privacidade), mesmo padrão
// de src/app/nps/[token]/page.tsx.
export const metadata = {
  title: "Política de Privacidade — CRM Viagente",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="space-y-2 text-sm text-muted-foreground">{children}</div>
    </section>
  );
}

export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto max-w-2xl space-y-8 p-6 py-12">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-foreground">Política de Privacidade</h1>
        <p className="text-sm text-muted-foreground">Última atualização: 17 de julho de 2026.</p>
      </div>

      <p className="text-sm text-muted-foreground">
        Este documento descreve como a Viagente — Agência e Gestão de Viagens coleta, usa e
        protege dados pessoais dentro do seu CRM interno (&quot;o Sistema&quot;), usado pela
        equipe da Viagente para gerenciar o relacionamento com clientes e leads.
      </p>

      <Section title="1. Quem somos">
        <p>
          A Viagente é uma agência de viagens e gestão de milhas. O Sistema é uma ferramenta
          interna, usada pela nossa equipe para atender clientes e organizar o funil comercial —
          não é um produto oferecido a terceiros.
        </p>
      </Section>

      <Section title="2. Dados que coletamos">
        <p>Coletamos e armazenamos, sobre clientes e leads que interagem com a Viagente:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Nome, telefone, email e outras informações de contato fornecidas voluntariamente;</li>
          <li>
            Conteúdo de mensagens trocadas pelos canais de atendimento conectados (WhatsApp e
            Instagram Direct);
          </li>
          <li>Identificador da conta do Instagram (quando o contato entra em contato por lá);</li>
          <li>
            Dados comerciais relacionados ao atendimento (negócios, etapas do funil, tarefas,
            histórico de interação);
          </li>
          <li>Eventos de agenda, quando uma reunião é agendada via Google Agenda;</li>
          <li>Registros de emails enviados a pedido da equipe da Viagente.</li>
        </ul>
      </Section>

      <Section title="3. Como usamos esses dados">
        <p>
          Usamos esses dados exclusivamente para prestar atendimento, dar seguimento comercial e
          organizar o relacionamento entre a Viagente e seus clientes/leads — nunca para venda a
          terceiros ou finalidade divergente da relação comercial existente.
        </p>
      </Section>

      <Section title="4. Compartilhamento com terceiros">
        <p>Pra funcionar, o Sistema se integra com os seguintes provedores, estritamente como processadores técnicos:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Meta (WhatsApp Business e Instagram) — troca de mensagens de atendimento;</li>
          <li>Google (Google Agenda) — agendamento de reuniões, quando conectado;</li>
          <li>Provedor de envio de email transacional, pra emails disparados pela equipe;</li>
          <li>Provedor de hospedagem e banco de dados (Vercel/Neon), pra operação do Sistema.</li>
        </ul>
        <p>Nenhum desses provedores recebe autorização pra usar os dados pra finalidade própria.</p>
      </Section>

      <Section title="5. Segurança e retenção">
        <p>
          Credenciais de acesso a canais de terceiros são armazenadas criptografadas. O acesso ao
          Sistema é restrito à equipe autorizada da Viagente, via login individual. Os dados são
          mantidos pelo tempo necessário à relação comercial, e podem ser excluídos mediante
          solicitação — ver{" "}
          <a href="/exclusao-de-dados" className="text-primary hover:underline">
            Exclusão de dados
          </a>
          .
        </p>
      </Section>

      <Section title="6. Seus direitos (LGPD)">
        <p>
          Nos termos da Lei Geral de Proteção de Dados (Lei 13.709/2018), você pode solicitar a
          qualquer momento acesso, correção, portabilidade ou exclusão dos seus dados pessoais
          mantidos pela Viagente, entrando em contato pelo email{" "}
          <a href="mailto:contato@viagt.com.br" className="text-primary hover:underline">
            contato@viagt.com.br
          </a>
          .
        </p>
      </Section>

      <Section title="7. Contato">
        <p>
          Dúvidas sobre esta política podem ser enviadas para{" "}
          <a href="mailto:contato@viagt.com.br" className="text-primary hover:underline">
            contato@viagt.com.br
          </a>
          .
        </p>
      </Section>
    </main>
  );
}

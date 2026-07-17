import { notFound } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getNpsSurveyForToken } from "@/lib/nps";
import { NpsForm } from "./nps-form";

export const dynamic = "force-dynamic";

// Sem AppShell, sem auth() — página pública respondida pelo cliente final
// (ver Etapa 27), mesmo padrão de "rota sem chrome" do /login.
export default async function NpsPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const survey = await getNpsSurveyForToken(token);
  if (!survey) notFound();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-4">
      {/* eslint-disable-next-line @next/next/no-img-element -- logo estática, sem next/image usado no restante do projeto */}
      <img src="/viagente-logo.png" alt="Viagente" className="h-12 w-auto dark:hidden" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/viagente-logo-dark.png" alt="Viagente" className="hidden h-12 w-auto dark:block" />
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Sua opinião é muito importante</CardTitle>
          <CardDescription>
            De 0 a 10, o quanto você recomendaria a Viagente pra um amigo ou familiar?
          </CardDescription>
        </CardHeader>
        <CardContent>
          {survey.respondedAt ? (
            <p className="text-sm text-status-success">
              Obrigado! Sua resposta já foi registrada.
            </p>
          ) : (
            <NpsForm token={token} />
          )}
        </CardContent>
      </Card>
    </main>
  );
}

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-4">
      {/* eslint-disable-next-line @next/next/no-img-element -- logo estática, sem next/image usado no restante do projeto */}
      <img
        src="/viagente-logo.png"
        alt="Viagente"
        className="h-14 w-auto dark:hidden"
      />
      {/* Versão clara do logo pro tema escuro (fundo #111111) — a versão
          padrão tem o texto em navy, que fica ilegível em fundo escuro. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/viagente-logo-dark.png"
        alt="Viagente"
        className="hidden h-14 w-auto dark:block"
      />
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">CRM Viagente</CardTitle>
          <CardDescription>Entre com seu email e senha.</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
    </main>
  );
}

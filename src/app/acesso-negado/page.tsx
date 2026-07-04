import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function AcessoNegadoPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-4 text-center">
      <h1 className="text-2xl font-semibold">Acesso negado</h1>
      <p className="text-muted-foreground max-w-sm">
        Você não tem permissão para acessar esta área. Fale com um
        administrador se acha que isso é um engano.
      </p>
      <Link href="/" className={buttonVariants({ variant: "default" })}>
        Voltar
      </Link>
    </main>
  );
}

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppShell } from "@/components/app-shell";

export default async function HomePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.mustChangePassword) redirect("/trocar-senha");

  return (
    <AppShell>
      <div className="p-6">
        <h1 className="text-2xl font-bold">Bem-vindo, {session.user.name}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          CRM Viagente — pipelines e negócios chegam na próxima etapa.
        </p>
      </div>
    </AppShell>
  );
}

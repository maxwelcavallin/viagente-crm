import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Nav } from "@/components/nav";

export default async function HomePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.mustChangePassword) redirect("/trocar-senha");

  return (
    <>
      <Nav />
      <main className="p-6">
        <h1 className="text-2xl font-semibold">
          Bem-vindo, {session.user.name}
        </h1>
        <p className="text-muted-foreground mt-2">
          CRM Viagente — pipelines e negócios chegam na próxima etapa.
        </p>
      </main>
    </>
  );
}

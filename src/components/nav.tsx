import Link from "next/link";
import { auth, signOut } from "@/auth";
import { Button } from "@/components/ui/button";

export async function Nav() {
  const session = await auth();
  if (!session?.user) return null;

  return (
    <nav className="flex items-center justify-between border-b p-4">
      <div className="flex items-center gap-4">
        <Link href="/" className="font-semibold">
          CRM Viagente
        </Link>
        {session.user.role === "admin" && (
          <>
            <Link
              href="/admin/usuarios"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Usuários
            </Link>
            <Link
              href="/admin/pipelines"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Pipelines
            </Link>
          </>
        )}
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">
          {session.user.name} ({session.user.role})
        </span>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <Button type="submit" variant="outline" size="sm">
            Sair
          </Button>
        </form>
      </div>
    </nav>
  );
}

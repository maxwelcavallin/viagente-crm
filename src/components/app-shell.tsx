import { auth, signOut } from "@/auth";
import { Button } from "@/components/ui/button";
import { SidebarNav } from "@/components/sidebar-nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { MobileNavDrawer } from "@/components/mobile-nav-drawer";

export async function AppShell({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) return <>{children}</>;

  const { name, role } = session.user;

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4 lg:px-6">
        <div className="flex items-center gap-3">
          <MobileNavDrawer role={role} />
          <span className="text-base font-bold">CRM Viagente</span>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <span className="hidden text-sm text-muted-foreground sm:inline">
            {name} ({role})
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
      </header>
      <div className="flex flex-1 overflow-hidden">
        <aside className="hidden w-60 shrink-0 overflow-y-auto border-r border-border lg:block">
          <SidebarNav role={role} />
        </aside>
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}

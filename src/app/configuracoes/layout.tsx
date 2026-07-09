import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppShell } from "@/components/app-shell";
import { SettingsNav } from "@/components/settings-nav";

export default async function ConfiguracoesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "admin") redirect("/acesso-negado");

  return (
    <AppShell>
      <div className="flex flex-col gap-6 p-4 sm:p-6 lg:flex-row lg:gap-8 lg:p-8">
        <SettingsNav className="border-b border-border pb-3 lg:w-64 lg:shrink-0 lg:flex-col lg:overflow-visible lg:border-b-0 lg:border-r lg:pb-0 lg:pr-6" />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </AppShell>
  );
}

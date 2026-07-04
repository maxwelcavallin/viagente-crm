import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppShell } from "@/components/app-shell";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "admin") redirect("/acesso-negado");

  return (
    <AppShell>
      <div className="p-4 sm:p-6 lg:p-8">{children}</div>
    </AppShell>
  );
}

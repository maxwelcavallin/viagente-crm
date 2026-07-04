import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Nav } from "@/components/nav";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "admin") redirect("/acesso-negado");

  return (
    <>
      <Nav />
      <main className="p-6">{children}</main>
    </>
  );
}

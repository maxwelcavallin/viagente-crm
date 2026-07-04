import { db } from "@/db";
import { users } from "@/db/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreateUserForm } from "./create-user-form";
import { UsersTable } from "./users-table";

export default async function UsuariosPage() {
  const allUsers = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      mustChangePassword: users.mustChangePassword,
    })
    .from(users)
    .orderBy(users.createdAt);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Usuários</h1>
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Usuários cadastrados</CardTitle>
          </CardHeader>
          <CardContent>
            <UsersTable users={allUsers} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Novo usuário</CardTitle>
          </CardHeader>
          <CardContent>
            <CreateUserForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

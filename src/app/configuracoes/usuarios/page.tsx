import { redirect } from "next/navigation";
import { asc } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { pipelines, userPipelineVisibility, users } from "@/db/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreateUserForm } from "./create-user-form";
import { UsersTable } from "./users-table";

export default async function UsuariosPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [allUsers, allPipelines, visibilityRows] = await Promise.all([
    db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        mustChangePassword: users.mustChangePassword,
        restrictToOwnRecords: users.restrictToOwnRecords,
        defaultPipelineId: users.defaultPipelineId,
      })
      .from(users)
      .orderBy(users.createdAt),
    db
      .select({ id: pipelines.id, name: pipelines.name })
      .from(pipelines)
      .orderBy(asc(pipelines.order)),
    db
      .select({
        userId: userPipelineVisibility.userId,
        pipelineId: userPipelineVisibility.pipelineId,
        visible: userPipelineVisibility.visible,
        order: userPipelineVisibility.order,
      })
      .from(userPipelineVisibility),
  ]);

  const visibilityByUserId = new Map<
    string,
    { pipelineId: string; visible: boolean; order: number }[]
  >();
  for (const row of visibilityRows) {
    const list = visibilityByUserId.get(row.userId) ?? [];
    list.push({ pipelineId: row.pipelineId, visible: row.visible, order: row.order });
    visibilityByUserId.set(row.userId, list);
  }

  const usersWithPipelines = allUsers.map((user) => ({
    ...user,
    pipelineSettings: visibilityByUserId.get(user.id) ?? [],
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Usuários</h1>
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Usuários cadastrados</CardTitle>
          </CardHeader>
          <CardContent>
            <UsersTable
              users={usersWithPipelines}
              currentUserId={session.user.id}
              allPipelines={allPipelines}
            />
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

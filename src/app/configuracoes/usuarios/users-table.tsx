import { Users } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { EditUserDialog } from "./edit-user-dialog";
import { DeleteUserDialog } from "./delete-user-dialog";

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "atendente";
  mustChangePassword: boolean;
  restrictToOwnRecords: boolean;
  defaultPipelineId: string | null;
  pipelineSettings: { pipelineId: string; visible: boolean; order: number }[];
};

export function UsersTable({
  users,
  currentUserId,
  allPipelines,
}: {
  users: UserRow[];
  currentUserId: string;
  allPipelines: { id: string; name: string }[];
}) {
  if (users.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="Nenhum usuário cadastrado"
        description="Crie o primeiro usuário pelo formulário ao lado."
      />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nome</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Status</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((user) => (
          <TableRow key={user.id}>
            <TableCell>{user.name}</TableCell>
            <TableCell>{user.email}</TableCell>
            <TableCell>
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                  {user.role}
                </Badge>
                {user.restrictToOwnRecords && (
                  <Badge variant="outline">Restrito ao próprio</Badge>
                )}
              </div>
            </TableCell>
            <TableCell>
              {user.mustChangePassword ? (
                <span className="text-muted-foreground">
                  Aguardando primeiro login
                </span>
              ) : (
                "Ativo"
              )}
            </TableCell>
            <TableCell>
              <div className="flex items-center justify-end gap-1.5">
                <EditUserDialog user={user} allPipelines={allPipelines} />
                {user.id !== currentUserId && <DeleteUserDialog user={user} />}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

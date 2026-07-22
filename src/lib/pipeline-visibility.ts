import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { pipelines, userPipelineVisibility } from "@/db/schema";

export type PipelineOption = { id: string; name: string };

// Pipelines visíveis pra esse usuário na barra de abas de /negocios, na
// ordem configurada — ver configuracoes/usuarios/edit-user-dialog.tsx (onde
// o admin define isso por usuário). Pipeline sem registro em
// user_pipeline_visibility (nova, criada depois da última configuração pro
// usuário) conta como visível, com a ordem global como fallback — nunca some
// sozinha até alguém desmarcar explicitamente. Admin sempre vê todas,
// independente de `visible`, mas ainda respeita a ordem configurada.
export async function getPipelinesForUser(user: {
  id: string;
  role: "admin" | "atendente";
}): Promise<PipelineOption[]> {
  const [allPipelines, settingsRows] = await Promise.all([
    db
      .select({ id: pipelines.id, name: pipelines.name, order: pipelines.order })
      .from(pipelines)
      .orderBy(asc(pipelines.order)),
    db
      .select({
        pipelineId: userPipelineVisibility.pipelineId,
        visible: userPipelineVisibility.visible,
        order: userPipelineVisibility.order,
      })
      .from(userPipelineVisibility)
      .where(eq(userPipelineVisibility.userId, user.id)),
  ]);

  const settingByPipelineId = new Map(settingsRows.map((s) => [s.pipelineId, s]));

  return allPipelines
    .map((p) => {
      const setting = settingByPipelineId.get(p.id);
      return {
        id: p.id,
        name: p.name,
        visible: setting?.visible ?? true,
        order: setting?.order ?? p.order,
      };
    })
    .filter((p) => user.role === "admin" || p.visible)
    .sort((a, b) => a.order - b.order)
    .map(({ id, name }) => ({ id, name }));
}

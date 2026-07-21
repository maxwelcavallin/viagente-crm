import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getMediaSignedUrl } from "@/lib/storage";

export const dynamic = "force-dynamic";

// Espelha /api/templates/media/[itemId] (redireciona pra uma URL assinada de
// curta duração no R2) — qualquer usuário autenticado pode ver a foto de
// qualquer outro (é só o avatar exibido em negócios/tarefas/etc, não dado
// sensível), diferente do upload que só o dono da conta pode fazer.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { userId } = await params;

  const [user] = await db
    .select({ avatarUrl: users.avatarUrl })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user?.avatarUrl) {
    return Response.json({ error: "Sem foto de perfil" }, { status: 404 });
  }

  try {
    const signedUrl = await getMediaSignedUrl(`avatars/${userId}`);
    return Response.redirect(signedUrl, 302);
  } catch (error) {
    console.error("[avatar proxy] falha ao gerar URL assinada", error);
    return Response.json({ error: "Foto indisponível" }, { status: 404 });
  }
}

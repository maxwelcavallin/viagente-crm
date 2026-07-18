import { auth } from "@/auth";
import { mergeInstagramContactInto } from "@/lib/contact-merge";

export const dynamic = "force-dynamic";

// Funde um contato criado automaticamente a partir do Instagram Direct
// dentro de um contato já existente no CRM — ver mergeInstagramContactInto.
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Não autenticado" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    sourceContactId?: string;
    targetContactId?: string;
  } | null;

  if (!body?.sourceContactId || !body?.targetContactId) {
    return Response.json(
      { error: "sourceContactId e targetContactId são obrigatórios" },
      { status: 400 }
    );
  }

  const result = await mergeInstagramContactInto(body.sourceContactId, body.targetContactId);
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 400 });
  }

  return Response.json({ ok: true });
}

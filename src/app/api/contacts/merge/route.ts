import { auth } from "@/auth";
import { mergeContactsInto } from "@/lib/contact-merge";

export const dynamic = "force-dynamic";

// Funde dois contatos que representam a mesma pessoa (telefone/email
// duplicado) — ver DuplicateContactBanner e mergeContactsInto. Diferente de
// /api/contacts/merge-instagram (específico do fluxo de vincular contato do
// Instagram, com validações próprias).
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

  const result = await mergeContactsInto(body.sourceContactId, body.targetContactId);
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 400 });
  }

  return Response.json({ ok: true });
}

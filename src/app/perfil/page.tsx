import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/db";
import { googleCalendarConnections, googleCalendarShares, users } from "@/db/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GoogleConnectionCard } from "@/components/google-connection-card";
import { disconnectGoogleAction } from "./actions";

export const dynamic = "force-dynamic";

const GOOGLE_ERROR_LABELS: Record<string, string> = {
  access_denied: "Você cancelou a conexão com o Google.",
  invalid_state: "A conexão expirou ou foi iniciada em outra aba — tente de novo.",
  exchange_failed: "Não foi possível concluir a conexão com o Google. Tente de novo.",
};

export default async function PerfilPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; googleError?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { connected, googleError } = await searchParams;

  const [ownConnection] = await db
    .select()
    .from(googleCalendarConnections)
    .where(eq(googleCalendarConnections.userId, session.user.id))
    .limit(1);

  let sharedByName: string | null = null;
  if (!ownConnection) {
    const [share] = await db
      .select({ ownerUserId: googleCalendarShares.ownerUserId })
      .from(googleCalendarShares)
      .where(eq(googleCalendarShares.sharedWithUserId, session.user.id))
      .limit(1);
    if (share) {
      const [owner] = await db
        .select({ name: users.name })
        .from(users)
        .where(eq(users.id, share.ownerUserId))
        .limit(1);
      sharedByName = owner?.name ?? null;
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Meu Perfil</h1>
        <p className="text-sm text-muted-foreground">
          {session.user.name} — {session.user.role === "admin" ? "Administrador" : "Atendente"}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Google Agenda</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {connected === "1" && (
            <p className="text-sm text-status-success">Conta do Google conectada com sucesso.</p>
          )}
          {googleError && (
            <p className="text-sm text-destructive">
              {GOOGLE_ERROR_LABELS[googleError] ?? "Falha ao conectar com o Google."}
            </p>
          )}
          <GoogleConnectionCard
            connected={!!ownConnection}
            connectedAt={ownConnection?.connectedAt.toISOString() ?? null}
            sharedByName={sharedByName}
            onDisconnect={disconnectGoogleAction}
          />
        </CardContent>
      </Card>
    </div>
  );
}

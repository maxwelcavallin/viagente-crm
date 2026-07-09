import { asc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/db";
import { googleCalendarConnections, googleCalendarShares, users } from "@/db/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GoogleConnectionCard } from "@/components/google-connection-card";
import { ShareWithAttendantsList } from "./share-with-attendants-list";
import { disconnectGoogleAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function GoogleAgendaSettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [ownConnection, attendants, shareRows] = await Promise.all([
    db
      .select()
      .from(googleCalendarConnections)
      .where(eq(googleCalendarConnections.userId, session.user.id))
      .limit(1)
      .then((r) => r[0]),
    db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(eq(users.role, "atendente"))
      .orderBy(asc(users.name)),
    db
      .select({ sharedWithUserId: googleCalendarShares.sharedWithUserId })
      .from(googleCalendarShares)
      .where(eq(googleCalendarShares.ownerUserId, session.user.id)),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Google Agenda</h1>

      <Card>
        <CardHeader>
          <CardTitle>Sua conexão</CardTitle>
        </CardHeader>
        <CardContent>
          <GoogleConnectionCard
            connected={!!ownConnection}
            connectedAt={ownConnection?.connectedAt.toISOString() ?? null}
            sharedByName={null}
            onDisconnect={disconnectGoogleAction}
          />
        </CardContent>
      </Card>

      {ownConnection && (
        <Card>
          <CardHeader>
            <CardTitle>Compartilhar com atendentes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Atendentes marcados abaixo podem criar agendamentos usando a sua agenda
              conectada, sem precisar conectar a própria conta.
            </p>
            <ShareWithAttendantsList
              attendants={attendants}
              sharedUserIds={shareRows.map((r) => r.sharedWithUserId)}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

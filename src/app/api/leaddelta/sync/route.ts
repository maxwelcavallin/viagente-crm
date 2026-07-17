import { eq, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { leaddeltaConnections, leaddeltaSettings, leaddeltaSyncLog } from "@/db/schema";
import { decryptCredential } from "@/lib/credentials-crypto";
import { buildConnectionRecord } from "@/lib/leaddelta-analytics";
import { fetchAllConnections, LeadDeltaAuthError } from "@/lib/leaddelta-client";

// Sincronização pode levar bastante tempo (paginação completa + espera em
// rate limit) dependendo do volume de conexões — maxDuration alto pra não
// estourar o limite padrão de função serverless.
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const UPSERT_CHUNK_SIZE = 500;

export async function POST() {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    return Response.json({ error: "unauthenticated" }, { status: 401 });
  }

  const [settings] = await db.select().from(leaddeltaSettings).limit(1);
  if (!settings) {
    return Response.json(
      { error: "not_configured", message: "API Key da LeadDelta não configurada." },
      { status: 400 }
    );
  }

  const startedAt = new Date();
  const apiKey = decryptCredential(settings.apiKey);

  try {
    const raw = await fetchAllConnections(apiKey);
    const records = raw.map(buildConnectionRecord);

    for (let i = 0; i < records.length; i += UPSERT_CHUNK_SIZE) {
      const chunk = records.slice(i, i + UPSERT_CHUNK_SIZE);
      if (chunk.length === 0) continue;
      await db
        .insert(leaddeltaConnections)
        .values(chunk)
        .onConflictDoUpdate({
          target: leaddeltaConnections.leaddeltaId,
          set: {
            firstName: sql`excluded.first_name`,
            lastName: sql`excluded.last_name`,
            headline: sql`excluded.headline`,
            company: sql`excluded.company`,
            jobTitle: sql`excluded.job_title`,
            location: sql`excluded.location`,
            locationNormalized: sql`excluded.location_normalized`,
            email: sql`excluded.email`,
            linkedinUrl: sql`excluded.linkedin_url`,
            workspaceName: sql`excluded.workspace_name`,
            tags: sql`excluded.tags`,
            funnelStage: sql`excluded.funnel_stage`,
            profile: sql`excluded.profile`,
            hasEmail: sql`excluded.has_email`,
            hasNotes: sql`excluded.has_notes`,
            hasPhone: sql`excluded.has_phone`,
            connectedAt: sql`excluded.connected_at`,
            syncedAt: sql`excluded.synced_at`,
          },
        });
    }

    await db.insert(leaddeltaSyncLog).values({
      startedAt,
      finishedAt: new Date(),
      connectionsCount: records.length,
      status: "sucesso",
    });
    await db
      .update(leaddeltaSettings)
      .set({ lastSyncedAt: new Date() })
      .where(eq(leaddeltaSettings.id, settings.id));

    return Response.json({ ok: true, count: records.length });
  } catch (err) {
    const message =
      err instanceof LeadDeltaAuthError
        ? err.message
        : err instanceof Error
          ? err.message
          : "Erro desconhecido na sincronização.";

    await db.insert(leaddeltaSyncLog).values({
      startedAt,
      finishedAt: new Date(),
      connectionsCount: 0,
      status: "erro",
      errorMessage: message,
    });

    console.error("[api/leaddelta/sync] falha na sincronização", err);
    return Response.json({ ok: false, message }, { status: 502 });
  }
}

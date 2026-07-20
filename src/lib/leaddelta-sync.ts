// Lógica compartilhada de sincronização com a LeadDelta — usada tanto pelo
// botão manual ("Sincronizar agora" em /configuracoes/linkedin) quanto pelo
// cron diário (ver vercel.json). Mantida separada da rota pra evitar duas
// implementações divergentes do mesmo fluxo de upsert.

import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { leaddeltaConnections, leaddeltaSettings, leaddeltaSyncLog } from "@/db/schema";
import { decryptCredential } from "@/lib/credentials-crypto";
import { buildConnectionRecord } from "@/lib/leaddelta-analytics";
import { fetchAllConnections, LeadDeltaAuthError } from "@/lib/leaddelta-client";

const UPSERT_CHUNK_SIZE = 500;

export type LeadDeltaSyncResult =
  | { ok: true; count: number }
  | { ok: false; message: string };

export async function runLeadDeltaSync(): Promise<LeadDeltaSyncResult> {
  const [settings] = await db.select().from(leaddeltaSettings).limit(1);
  if (!settings) {
    return { ok: false, message: "API Key da LeadDelta não configurada." };
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

    return { ok: true, count: records.length };
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

    console.error("[leaddelta-sync] falha na sincronização", err);
    return { ok: false, message };
  }
}

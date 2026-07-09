"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/db";
import { googleCalendarShares } from "@/db/schema";
import { disconnectGoogleCalendar } from "@/lib/google-calendar";

async function requireAdminUserId(): Promise<string | null> {
  const session = await auth();
  if (session?.user?.role !== "admin") return null;
  return session.user.id;
}

export async function toggleShareAction(
  atendenteId: string,
  share: boolean
): Promise<{ ok: boolean }> {
  const adminId = await requireAdminUserId();
  if (!adminId) return { ok: false };

  if (share) {
    await db
      .insert(googleCalendarShares)
      .values({ ownerUserId: adminId, sharedWithUserId: atendenteId })
      .onConflictDoNothing();
  } else {
    await db
      .delete(googleCalendarShares)
      .where(
        and(
          eq(googleCalendarShares.ownerUserId, adminId),
          eq(googleCalendarShares.sharedWithUserId, atendenteId)
        )
      );
  }

  revalidatePath("/configuracoes/google-agenda");
  return { ok: true };
}

export async function disconnectGoogleAction(): Promise<{ ok: boolean }> {
  const adminId = await requireAdminUserId();
  if (!adminId) return { ok: false };

  await disconnectGoogleCalendar(adminId);
  revalidatePath("/configuracoes/google-agenda");
  return { ok: true };
}

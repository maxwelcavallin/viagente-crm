"use server";

import { auth } from "@/auth";
import { disconnectGoogleCalendar } from "@/lib/google-calendar";

export async function disconnectGoogleAction(): Promise<{ ok: boolean }> {
  const session = await auth();
  if (!session?.user) return { ok: false };

  await disconnectGoogleCalendar(session.user.id);
  return { ok: true };
}

import { cookies } from "next/headers";
import { auth } from "@/auth";
import { exchangeCodeForTokens, saveGoogleCalendarConnection } from "@/lib/google-calendar";

export const dynamic = "force-dynamic";

const STATE_COOKIE = "google_oauth_state";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.redirect(new URL("/login", request.url));
  }

  const url = new URL(request.url);
  const error = url.searchParams.get("error");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const cookieStore = await cookies();
  const expectedState = cookieStore.get(STATE_COOKIE)?.value;
  cookieStore.delete(STATE_COOKIE);

  if (error) {
    return Response.redirect(
      new URL(`/perfil?googleError=${encodeURIComponent(error)}`, request.url)
    );
  }
  if (!code || !state || !expectedState || state !== expectedState) {
    return Response.redirect(new URL("/perfil?googleError=invalid_state", request.url));
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    await saveGoogleCalendarConnection({
      userId: session.user.id,
      refreshToken: tokens.refreshToken,
      accessToken: tokens.accessToken,
      expiresAt: tokens.expiresAt,
    });
  } catch (e) {
    console.error("[google/callback] falha ao concluir conexão", e);
    return Response.redirect(new URL("/perfil?googleError=exchange_failed", request.url));
  }

  return Response.redirect(new URL("/perfil?connected=1", request.url));
}

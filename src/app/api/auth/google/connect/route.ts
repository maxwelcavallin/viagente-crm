import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { getGoogleAuthUrl } from "@/lib/google-calendar";

export const dynamic = "force-dynamic";

const STATE_COOKIE = "google_oauth_state";

// Inicia o fluxo OAuth pra conectar a agenda do próprio usuário logado.
// access_type=offline + prompt=consent (dentro de getGoogleAuthUrl) garantem
// que o refresh_token venha mesmo em reconexões — sem isso o Google só
// retorna refresh_token na primeira autorização.
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.redirect(new URL("/login", request.url));
  }

  const state = randomBytes(16).toString("hex");
  const cookieStore = await cookies();
  cookieStore.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 300,
    path: "/",
  });

  return Response.redirect(getGoogleAuthUrl(state));
}

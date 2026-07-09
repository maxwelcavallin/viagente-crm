import { eq } from "drizzle-orm";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { db } from "@/db";
import { users } from "@/db/schema";
import { verifyPassword } from "@/lib/password";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email;
        const password = credentials?.password;
        if (typeof email !== "string" || typeof password !== "string") {
          return null;
        }

        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, email.toLowerCase().trim()))
          .limit(1);

        if (!user) return null;

        const valid = await verifyPassword(password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          mustChangePassword: user.mustChangePassword,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.mustChangePassword = user.mustChangePassword;
      }

      // Disparado por `useSession().update()` — relemos o banco pra pegar o
      // estado real de must_change_password/role após uma mutação (ex:
      // troca de senha), em vez de confiar em valor que o client mandou.
      if (trigger === "update") {
        const [fresh] = await db
          .select()
          .from(users)
          .where(eq(users.id, token.id))
          .limit(1);
        if (fresh) {
          token.role = fresh.role;
          token.mustChangePassword = fresh.mustChangePassword;
        }
      }

      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id;
      session.user.role = token.role;
      session.user.mustChangePassword = token.mustChangePassword;
      return session;
    },
    authorized({ request, auth }) {
      const { pathname } = request.nextUrl;

      const isPublic =
        pathname === "/login" ||
        pathname.startsWith("/api/auth") ||
        pathname === "/api/health" ||
        // Chamadas externas (Z-API, Vercel Cron e webhooks de entrada de
        // terceiros) não têm sessão — cada uma valida a origem por conta
        // própria (instanceId do canal, CRON_SECRET e secret_token do
        // webhook_config, respectivamente). Ver src/app/api/whatsapp/webhook,
        // src/app/api/cron/cleanup-media e src/app/api/webhooks/inbound.
        pathname.startsWith("/api/whatsapp/webhook") ||
        pathname === "/api/cron/cleanup-media" ||
        pathname === "/api/cron/send-scheduled-messages" ||
        pathname.startsWith("/api/webhooks/inbound");

      if (!auth) {
        return isPublic;
      }

      if (pathname === "/login") {
        return Response.redirect(new URL("/", request.url));
      }

      if (auth.user.mustChangePassword && pathname !== "/trocar-senha") {
        return Response.redirect(new URL("/trocar-senha", request.url));
      }

      if (pathname.startsWith("/configuracoes") && auth.user.role !== "admin") {
        return Response.redirect(new URL("/acesso-negado", request.url));
      }

      return true;
    },
  },
});

import type { DefaultSession } from "next-auth";

// next-auth (v5 beta) re-exporta Session/User de "@auth/core/types" e JWT de
// "@auth/core/jwt" via `export *`/`export type` em vez de declará-los
// localmente — a extensão de módulo do TypeScript só funciona no módulo onde
// a interface é de fato declarada, então augmentamos "@auth/core/*" aqui, não
// "next-auth"/"next-auth/jwt".
declare module "@auth/core/types" {
  interface User {
    id: string;
    role: "admin" | "atendente";
    mustChangePassword: boolean;
  }

  interface Session {
    user: {
      id: string;
      role: "admin" | "atendente";
      mustChangePassword: boolean;
    } & DefaultSession["user"];
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    role: "admin" | "atendente";
    mustChangePassword: boolean;
  }
}

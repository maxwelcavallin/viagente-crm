// Next.js 16 renomeou middleware.ts -> proxy.ts (a função continua com a
// mesma assinatura de (request, event) => Response). Toda a lógica de
// autorização está no callback `authorized` em src/auth.ts.
// Precisa ser um `export default` direto (não um re-export) — o build do
// Next.js faz análise estática desse arquivo e não reconhece
// `export { auth as default } from "..."` como uma função proxy válida.
import { auth } from "@/auth";

export default auth;

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/auth|api/health).*)",
  ],
};

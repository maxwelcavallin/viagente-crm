import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { users } from "../src/db/schema";
import { generateTempPassword, hashPassword } from "../src/lib/password";

async function main() {
  const [name, emailArg] = process.argv.slice(2);

  if (!name || !emailArg) {
    console.error(
      'Uso: npm run create-admin -- "Nome Completo" "email@dominio.com"'
    );
    process.exit(1);
  }

  const email = emailArg.toLowerCase().trim();

  const [existing] = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing) {
    console.log(
      `Já existe um usuário com o email ${email} (role: ${existing.role}). Nada foi alterado.`
    );
    console.log(
      "Se precisar resetar a senha dele, use a tela /admin/usuarios (login como outro admin) ou rode este script com um email diferente."
    );
    process.exit(0);
  }

  const tempPassword = generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);

  await db.insert(users).values({
    name: name.trim(),
    email,
    role: "admin",
    passwordHash,
    mustChangePassword: true,
  });

  console.log("Admin criado com sucesso. Copie a senha agora:");
  console.log("");
  console.log(`  Email: ${email}`);
  console.log(`  Senha temporária: ${tempPassword}`);
  console.log("");
  console.log(
    "No primeiro login o sistema vai forçar a troca dessa senha."
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Erro ao criar admin:", error);
    process.exit(1);
  });

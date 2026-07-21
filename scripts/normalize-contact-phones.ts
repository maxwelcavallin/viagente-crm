import { eq, isNotNull } from "drizzle-orm";
import { db } from "../src/db";
import { contacts } from "../src/db/schema";
import { mergeContactsInto } from "../src/lib/contact-merge";
import { normalizePhoneNumber } from "../src/lib/phone";

// Backfill único: normaliza todo contacts.phone existente pro formato
// canônico (DDI + DDD + número, só dígitos — ver normalizePhoneNumber) e
// consolida duplicatas que só existiam por causa de formatação diferente do
// mesmo número (ex: "+55 18 99679-8226", "18996798226" e "5518996798226" três
// contatos separados que na verdade são a mesma pessoa). Daqui pra frente,
// todo ponto de entrada (criação manual, API/MCP, webhook, importação CSV,
// webhook do WhatsApp) já grava normalizado — ver normalizePhoneNumber em
// src/lib/phone.ts — então este script só existe pra sanear a base histórica.
//
// Roda em modo "dry run" por padrão (só imprime o que faria). Passe --apply
// pra gravar de verdade: `tsx --env-file=.env.local scripts/normalize-contact-phones.ts --apply`
//
// Contato de grupo do WhatsApp (isGroup=true) nunca é tocado — "phone" nesse
// caso é o id do grupo, não um telefone real.
//
// Agrupa TODOS os contatos pelo telefone canônico antes de escrever qualquer
// coisa (em vez de processar linha a linha em ordem) — necessário porque
// contacts_phone_idx é único: se o contato mais antigo do grupo (o
// "sobrevivente") ainda não tiver o valor canônico, mas outro contato do
// MESMO grupo já tiver esse valor gravado ao pé da letra (raro, mas
// aconteceu na base real), atualizar o sobrevivente ANTES de mesclar esse
// outro embolaria com a constraint. Por isso: dentro de cada grupo, mescla
// primeiro todo mundo (menos o sobrevivente) e só then atualiza o telefone do
// sobrevivente pro canônico.
async function main() {
  const apply = process.argv.includes("--apply");

  const rows = await db
    .select({
      id: contacts.id,
      phone: contacts.phone,
      isGroup: contacts.isGroup,
      createdAt: contacts.createdAt,
    })
    .from(contacts)
    .where(isNotNull(contacts.phone))
    .orderBy(contacts.createdAt);

  type Row = { id: string; phone: string; createdAt: Date };
  const groups = new Map<string, Row[]>();
  let skippedGroup = 0;
  const problems: string[] = [];

  for (const row of rows) {
    if (row.isGroup) {
      skippedGroup++;
      continue;
    }
    const raw = row.phone!;
    const canonical = normalizePhoneNumber(raw);
    if (!canonical) {
      problems.push(`contato ${row.id}: telefone "${raw}" não tem nenhum dígito, pulado.`);
      continue;
    }
    const list = groups.get(canonical) ?? [];
    list.push({ id: row.id, phone: raw, createdAt: row.createdAt });
    groups.set(canonical, list);
  }

  let unchanged = 0;
  let updated = 0;
  let merged = 0;

  for (const [canonical, group] of groups) {
    group.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    const [survivor, ...duplicates] = group;

    for (const dup of duplicates) {
      console.log(`[merge] ${dup.id} ("${dup.phone}") -> mesclado em ${survivor.id} (telefone "${canonical}")`);
      merged++;
      if (apply) {
        const result = await mergeContactsInto(dup.id, survivor.id);
        if (!result.ok) {
          problems.push(`contato ${dup.id}: falha ao mesclar em ${survivor.id} — ${result.error}`);
        }
      }
    }

    if (survivor.phone !== canonical) {
      console.log(`[phone] ${survivor.id}: "${survivor.phone}" -> "${canonical}"`);
      updated++;
      if (apply) {
        await db.update(contacts).set({ phone: canonical }).where(eq(contacts.id, survivor.id));
      }
    } else {
      unchanged++;
    }
  }

  console.log(`\n${apply ? "Aplicado" : "Dry run (nada foi gravado — rode com --apply pra confirmar)"}`);
  console.log(`Contatos analisados: ${rows.length}`);
  console.log(`Já no formato canônico: ${unchanged}`);
  console.log(`Telefone normalizado: ${updated}`);
  console.log(`Duplicatas mescladas: ${merged}`);
  console.log(`Grupos (WhatsApp) ignorados: ${skippedGroup}`);
  if (problems.length > 0) {
    console.log(`\n${problems.length} problema(s):`);
    for (const p of problems) console.log(`  ${p}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Erro ao normalizar telefones de contatos:", error);
    process.exit(1);
  });

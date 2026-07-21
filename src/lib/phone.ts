// Formato canônico de telefone salvo em contacts.phone: DDI + DDD + número,
// só dígitos, sem "+" (ex: "5518996798226") — o mesmo formato que a Z-API usa
// nos payloads de entrada/saída (webhook "phone", body de /send-text etc), pra
// nunca haver mismatch entre o que o CRM salva e o que a Z-API espera na hora
// de mandar mensagem. Sem import de `db` de propósito — precisa ser
// importável tanto por server action/lib quanto por componente client (mesmo
// motivo do client/server boundary documentado em webhook-fields.ts).
//
// DDD é sempre um número de 11 a 99 no plano brasileiro (nenhuma área
// começa com "0" ou "1" sozinho) — usado pra decidir se um número de 10/11
// dígitos parece mesmo brasileiro antes de inserir o DDI.
function isBrazilianDdd(twoDigits: string): boolean {
  const n = Number(twoDigits);
  return n >= 11 && n <= 99;
}

// Heurística pra decidir se falta o DDI 55: CRM é uso brasileiro, então um
// número de 10 ou 11 dígitos SEM "+"/DDI já digitado é tratado como
// brasileiro faltando o "55" — mas só quando o formato bate com o plano de
// numeração local, pra não confundir com um número internacional que por
// coincidência tem o mesmo tamanho. Ex real encontrado na base: "+1 717 997
// 2963" (EUA, DDI 1 + 10 dígitos = 11 dígitos) quase virou "DDD 17" brasileiro
// por coincidência de tamanho — só não virou porque o 3º dígito ("1") não é
// "9", o marcador que todo celular brasileiro tem desde a expansão pro nono
// dígito. Um número que já começa com "55" e tem 12 ou 13 dígitos já está
// completo. Qualquer outro formato (DDI de outro país, número incompleto,
// ambíguo) é mantido só com a limpeza de dígitos, sem inventar prefixo —
// melhor deixar um número brasileiro raro sem normalizar do que corromper um
// número estrangeiro de verdade.
export function normalizePhoneNumber(raw: string): string | null {
  // Identificador interno do WhatsApp guardado como fallback em contacts.phone
  // quando o número real nunca foi revelado (ex: "<id>@lid" — ver
  // isMaskedPhone em handleIncomingMessage no webhook) ou veio de um
  // canal/newsletter ("<id>@newsletter") em vez de um contato de verdade —
  // não é um telefone discável, então nunca passa pela limpeza de dígitos
  // (senão perde o sufixo que o identifica como esse tipo especial e quebra o
  // match por igualdade usado pra resolver o próximo evento mascarado).
  if (raw.includes("@")) return raw;

  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;

  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    return digits;
  }
  // Celular: DDD + "9" + 8 dígitos.
  if (digits.length === 11 && isBrazilianDdd(digits.slice(0, 2)) && digits[2] === "9") {
    return `55${digits}`;
  }
  // Fixo: DDD + 8 dígitos, número local sempre começa em 2-5 no plano
  // brasileiro (6-9 é reservado pra celular, sempre com o "9" acima).
  if (
    digits.length === 10 &&
    isBrazilianDdd(digits.slice(0, 2)) &&
    ["2", "3", "4", "5"].includes(digits[2])
  ) {
    return `55${digits}`;
  }
  return digits;
}

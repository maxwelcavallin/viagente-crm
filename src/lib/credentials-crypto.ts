import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";

function getKey(): Buffer {
  const raw = process.env.CREDENTIALS_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error("CREDENTIALS_ENCRYPTION_KEY não está definida");
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error(
      "CREDENTIALS_ENCRYPTION_KEY precisa decodificar para 32 bytes (base64 de crypto.randomBytes(32))"
    );
  }
  return key;
}

// Formato armazenado: "<iv>.<authTag>.<ciphertext>", cada parte em base64.
export function encryptCredential(plainText: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(plainText, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return [iv, authTag, encrypted].map((part) => part.toString("base64")).join(".");
}

export function decryptCredential(stored: string): string {
  const [ivB64, tagB64, dataB64] = stored.split(".");
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error("Valor criptografado em formato inválido");
  }
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(tagB64, "base64");
  const data = Buffer.from(dataB64, "base64");

  const decipher = createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return decrypted.toString("utf8");
}

// Usado só para exibição na UI depois de salvo — nunca para lógica de auth.
export function maskCredential(plainText: string): string {
  const last4 = plainText.slice(-4);
  return `••••••${last4}`;
}

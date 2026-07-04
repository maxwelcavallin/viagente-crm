import { randomInt } from "node:crypto";
import bcrypt from "bcryptjs";

const SALT_ROUNDS = 10;
const TEMP_PASSWORD_CHARS =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

export function hashPassword(password: string) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export function generateTempPassword(length = 12) {
  let result = "";
  for (let i = 0; i < length; i++) {
    result += TEMP_PASSWORD_CHARS[randomInt(0, TEMP_PASSWORD_CHARS.length)];
  }
  return result;
}

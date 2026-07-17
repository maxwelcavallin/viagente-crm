import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Iniciais de avatar (fallback) — usa Array.from em vez de charAt(0) pra não
// quebrar em code units isolados de um par substituto UTF-16 (nomes que
// começam com emoji, comuns em grupos/contatos do WhatsApp). charAt(0) pega
// só a metade do par e .toUpperCase() nessa metade tem comportamento
// inconsistente entre engines JS — chegou a causar mismatch de hidratação.
export function initialOf(name: string): string {
  const first = Array.from(name.trim())[0]
  return first ? first.toUpperCase() : "?"
}

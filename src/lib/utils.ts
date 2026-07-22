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

// Download client-side sem round-trip ao servidor — os dados (resumo de
// reunião, conversa) já estão carregados na página; só monta um Blob e
// simula o clique num link temporário, padrão sem lib nenhuma.
export function downloadTextFile(
  filename: string,
  content: string,
  mime = "text/markdown;charset=utf-8"
) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

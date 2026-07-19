import { Fragment } from "react";

// Renderizador minimalista pro subconjunto de markdown usado nos artigos da
// Central de Ajuda (## título, listas numeradas/com marcador, **negrito** e
// `código` inline) — conteúdo é 100% escrito por nós via script de seed
// (scripts/seed-help-articles.ts), não é markdown de usuário, então não
// precisa de uma lib de parsing completa nem de sanitização.
function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={`${keyPrefix}-${i}`}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={`${keyPrefix}-${i}`} className="rounded bg-muted px-1 py-0.5 text-[0.85em]">
          {part.slice(1, -1)}
        </code>
      );
    }
    return <Fragment key={`${keyPrefix}-${i}`}>{part}</Fragment>;
  });
}

export function HelpMarkdown({ content }: { content: string }) {
  const blocks = content.split(/\n\s*\n/).filter((b) => b.trim());

  return (
    <div className="space-y-4 text-sm leading-relaxed">
      {blocks.map((block, blockIndex) => {
        const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
        const key = `block-${blockIndex}`;

        if (lines.length === 1 && lines[0].startsWith("## ")) {
          return (
            <h2 key={key} className="font-heading text-base font-semibold">
              {lines[0].slice(3)}
            </h2>
          );
        }

        if (lines.every((l) => /^\d+\.\s/.test(l))) {
          return (
            <ol key={key} className="list-decimal space-y-1.5 pl-5">
              {lines.map((l, i) => (
                <li key={i}>{renderInline(l.replace(/^\d+\.\s/, ""), `${key}-${i}`)}</li>
              ))}
            </ol>
          );
        }

        if (lines.every((l) => l.startsWith("- "))) {
          return (
            <ul key={key} className="list-disc space-y-1.5 pl-5">
              {lines.map((l, i) => (
                <li key={i}>{renderInline(l.slice(2), `${key}-${i}`)}</li>
              ))}
            </ul>
          );
        }

        return (
          <div key={key} className="space-y-2">
            {lines.map((l, i) => (
              <p key={i}>{renderInline(l, `${key}-${i}`)}</p>
            ))}
          </div>
        );
      })}
    </div>
  );
}

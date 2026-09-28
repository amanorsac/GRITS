import type { ReactNode } from 'react';

// Journal articles are written as plain text and turned into React elements here.
// No HTML is ever parsed or injected, so nothing typed in The Palace can run as code.
//
//   blank line   → new paragraph        ## Heading   → heading
//   > words      → quotation            - item       → bulleted list
//   **words**    → bold

export const FORMATTING_HINT = 'Leave a blank line between paragraphs. Start a line with “## ” for a heading, “> ” for a quotation, or “- ” for a bullet point. Wrap words in **double stars** for bold.';

type Block = { kind: 'p' | 'h2' | 'h3' | 'quote' | 'ul'; lines: string[] };

export function parseBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  let cur = null as Block | null;
  const flush = () => {
    if (cur && cur.lines.length) blocks.push(cur);
    cur = null;
  };
  for (const raw of text.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      flush();
      continue;
    }
    const t = line.trimStart();
    if (t.startsWith('### ')) {
      flush();
      blocks.push({ kind: 'h3', lines: [t.slice(4)] });
    } else if (t.startsWith('## ')) {
      flush();
      blocks.push({ kind: 'h2', lines: [t.slice(3)] });
    } else if (t.startsWith('>')) {
      if (cur?.kind !== 'quote') flush();
      cur ??= { kind: 'quote', lines: [] };
      cur.lines.push(t.replace(/^>\s?/, ''));
    } else if (/^[-*•]\s/.test(t)) {
      if (cur?.kind !== 'ul') flush();
      cur ??= { kind: 'ul', lines: [] };
      cur.lines.push(t.slice(2).trim());
    } else {
      if (cur && cur.kind !== 'p') flush();
      cur ??= { kind: 'p', lines: [] };
      cur.lines.push(t);
    }
  }
  flush();
  return blocks;
}

function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) => (part.startsWith('**') && part.endsWith('**') && part.length > 4 ? <strong key={i}>{part.slice(2, -2)}</strong> : part));
}

function withBreaks(lines: string[]) {
  return lines.map((l, i) => (
    <span key={i}>
      {i > 0 && <br />}
      {inline(l)}
    </span>
  ));
}

export function ArticleBody({ text }: { text: string }) {
  return (
    <div className="prose">
      {parseBlocks(text).map((b, i) => {
        if (b.kind === 'h2') return <h2 key={i}>{inline(b.lines[0]!)}</h2>;
        if (b.kind === 'h3') return <h3 key={i}>{inline(b.lines[0]!)}</h3>;
        if (b.kind === 'quote') return <blockquote key={i}>{withBreaks(b.lines)}</blockquote>;
        if (b.kind === 'ul')
          return (
            <ul key={i}>
              {b.lines.map((l, j) => (
                <li key={j}>{inline(l)}</li>
              ))}
            </ul>
          );
        return <p key={i}>{withBreaks(b.lines)}</p>;
      })}
    </div>
  );
}

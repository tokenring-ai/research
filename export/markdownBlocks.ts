import { lexer, type Token, type Tokens } from "marked";

/**
 * A small, format-neutral model of the Markdown a brief can carry, shared by the DOCX and PDF writers.
 * Server-only (nothing here is imported by the RPC schema).
 */

export interface Run {
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
  strike?: boolean;
  /** Absolute URL the run links to. */
  href?: string;
  /** A forced line break; `text` is empty. */
  br?: boolean;
}

export type Block =
  | { type: "heading"; depth: number; runs: Run[] }
  | { type: "paragraph"; runs: Run[] }
  | { type: "list"; ordered: boolean; start: number; items: Block[][] }
  | { type: "quote"; blocks: Block[] }
  | { type: "code"; text: string }
  | { type: "table"; align: ("left" | "center" | "right")[]; header: Run[][]; rows: Run[][][] }
  | { type: "rule" };

/** Things that could not be rendered faithfully, counted while parsing. */
export interface RenderNotes {
  images: number;
}

interface Style {
  bold?: boolean;
  italic?: boolean;
  strike?: boolean;
  href?: string;
}

function withStyle(base: Style, extra: Style): Style {
  return { ...base, ...extra };
}

function stripTags(html: string): string {
  return html.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "");
}

function run(text: string, style: Style, code = false): Run {
  return {
    text,
    ...(style.bold ? { bold: true } : {}),
    ...(style.italic ? { italic: true } : {}),
    ...(style.strike ? { strike: true } : {}),
    ...(style.href ? { href: style.href } : {}),
    ...(code ? { code: true } : {}),
  };
}

function safeHref(href: string): string | undefined {
  try {
    const url = new URL(href);
    return url.protocol === "http:" || url.protocol === "https:" || url.protocol === "mailto:" ? url.href : undefined;
  } catch {
    return undefined;
  }
}

function inline(tokens: readonly Token[] | undefined, style: Style, notes: RenderNotes): Run[] {
  const out: Run[] = [];
  for (const token of tokens ?? []) {
    switch (token.type) {
      case "strong":
        out.push(...inline((token as Tokens.Strong).tokens, withStyle(style, { bold: true }), notes));
        break;
      case "em":
        out.push(...inline((token as Tokens.Em).tokens, withStyle(style, { italic: true }), notes));
        break;
      case "del":
        out.push(...inline((token as Tokens.Del).tokens, withStyle(style, { strike: true }), notes));
        break;
      case "codespan":
        out.push(run((token as Tokens.Codespan).text, style, true));
        break;
      case "br":
        out.push({ text: "", br: true });
        break;
      case "link": {
        const link = token as Tokens.Link;
        const href = safeHref(link.href);
        out.push(...inline(link.tokens, href ? withStyle(style, { href }) : style, notes));
        break;
      }
      case "image": {
        notes.images += 1;
        const alt = (token as Tokens.Image).text;
        if (alt) out.push(run(`[image: ${alt}]`, withStyle(style, { italic: true })));
        break;
      }
      case "html":
        out.push(...splitBreaks(stripTags((token as Tokens.HTML).text), style));
        break;
      case "text":
      case "escape": {
        const text = token as Tokens.Text;
        if (text.tokens?.length) out.push(...inline(text.tokens, style, notes));
        else out.push(...splitBreaks(text.text, style));
        break;
      }
      default: {
        const raw = (token as { text?: string; raw?: string }).text ?? (token as { raw?: string }).raw ?? "";
        if (raw) out.push(run(raw, style));
      }
    }
  }
  return out;
}

/** Soft line breaks inside a paragraph are spaces; only explicit `\n` from HTML `<br>` stay breaks. */
function splitBreaks(text: string, style: Style): Run[] {
  const flattened = text.replace(/\r/g, "");
  return [run(flattened.replace(/\n/g, " "), style)];
}

function blocks(tokens: readonly Token[], notes: RenderNotes, depthShift: number): Block[] {
  const out: Block[] = [];
  for (const token of tokens) {
    switch (token.type) {
      case "heading": {
        const heading = token as Tokens.Heading;
        out.push({ type: "heading", depth: Math.min(6, heading.depth + depthShift), runs: inline(heading.tokens, {}, notes) });
        break;
      }
      case "paragraph":
      case "text": {
        const text = token as Tokens.Paragraph | Tokens.Text;
        const runs = text.tokens?.length ? inline(text.tokens, {}, notes) : [run(text.text, {})];
        if (runs.length) out.push({ type: "paragraph", runs });
        break;
      }
      case "list": {
        const list = token as Tokens.List;
        out.push({
          type: "list",
          ordered: list.ordered,
          start: typeof list.start === "number" ? list.start : 1,
          items: list.items.map(item => {
            const inner = blocks(item.tokens, notes, depthShift);
            if (item.task) {
              const mark = run(item.checked ? "[x] " : "[ ] ", {});
              const first = inner[0];
              if (first && (first.type === "paragraph" || first.type === "heading")) first.runs.unshift(mark);
              else inner.unshift({ type: "paragraph", runs: [mark] });
            }
            return inner;
          }),
        });
        break;
      }
      case "blockquote":
        out.push({ type: "quote", blocks: blocks((token as Tokens.Blockquote).tokens, notes, depthShift) });
        break;
      case "code":
        out.push({ type: "code", text: (token as Tokens.Code).text });
        break;
      case "hr":
        out.push({ type: "rule" });
        break;
      case "table": {
        const table = token as Tokens.Table;
        const cell = (c: Tokens.TableCell) => inline(c.tokens, {}, notes);
        out.push({
          type: "table",
          align: table.align.map(a => (a === "center" || a === "right" ? a : "left")),
          header: table.header.map(cell),
          rows: table.rows.map(row => row.map(cell)),
        });
        break;
      }
      case "html": {
        const text = stripTags((token as Tokens.HTML).text).trim();
        if (text) out.push({ type: "paragraph", runs: [run(text, {})] });
        break;
      }
      default:
        break; // space, def
    }
  }
  return out;
}

/**
 * Parses an item's Markdown. Headings inside the item are demoted by `depthShift` levels so
 * they nest under the item's own section heading.
 */
export function parseMarkdown(markdown: string, notes: RenderNotes, depthShift = 1): Block[] {
  return blocks(lexer(markdown), notes, depthShift);
}

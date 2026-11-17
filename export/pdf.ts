import { PDFDocument, type PDFFont, PDFName, type PDFPage, PDFString, rgb, StandardFonts } from "pdf-lib";
import { type BriefDocument, type BriefFile, noteWarnings, referenceDetail, referenceLabel, sourcesPointer } from "./briefDocument.ts";
import type { Block, Run } from "./markdownBlocks.ts";

/**
 * A small hand-rolled layout on pdf-lib's built-in fonts. The standard 14 fonts are metrics embedded in the library,
 * so nothing is read from disk (this runs inside a compiled binary). They only encode WinAnsi, so anything else
 * becomes "?" and is reported as a warning.
 */

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN_X = 72;
const MARGIN_TOP = 72;
const MARGIN_BOTTOM = 72;
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN_X;
const BODY_SIZE = 11;
const LEADING = 1.4;
const TEXT = rgb(0.1, 0.1, 0.1);
const MUTED = rgb(0.38, 0.38, 0.38);
const LINK = rgb(0.07, 0.33, 0.8);
const RULE = rgb(0.75, 0.75, 0.75);
const CODE_BG = rgb(0.95, 0.95, 0.95);
const HEADING_SIZES = [18, 15, 13, 12, 11, 11];

interface Fonts {
  regular: PDFFont;
  bold: PDFFont;
  italic: PDFFont;
  boldItalic: PDFFont;
  mono: PDFFont;
}

interface Atom {
  text: string;
  font: PDFFont;
  size: number;
  width: number;
  space: boolean;
  href?: string;
  color: ReturnType<typeof rgb>;
  strike?: boolean;
  br?: boolean;
}

interface Frame {
  /** Left edge of the text and its width. */
  x: number;
  width: number;
  /** x positions of quote bars to draw alongside each line. */
  bars: number[];
}

/** Common symbols outside WinAnsi that have an honest ASCII stand-in; these are swapped silently. */
const TRANSLITERATE: Record<string, string> = {
  "→": "->",
  "←": "<-",
  "↔": "<->",
  "⇒": "=>",
  "✓": "v",
  "✔": "v",
  "✗": "x",
  "✘": "x",
  "≥": ">=",
  "≤": "<=",
  "≠": "!=",
  "≈": "~",
  "−": "-",
  "‑": "-",
  "\u00a0": " ",
  "\u2009": " ",
  "\u202f": " ",
};

class Writer {
  readonly pdf: PDFDocument;
  readonly fonts: Fonts;
  private readonly charset: Set<number>;
  private page!: PDFPage;
  private y = 0;
  private links = new Map<PDFPage, ReturnType<PDFDocument["context"]["register"]>[]>();
  readonly replaced = new Map<string, number>();

  constructor(pdf: PDFDocument, fonts: Fonts) {
    this.pdf = pdf;
    this.fonts = fonts;
    this.charset = new Set(fonts.regular.getCharacterSet());
    this.newPage();
  }

  /** Text the fonts can encode; whatever they cannot becomes "?" and is counted. */
  sanitize(text: string): string {
    let out = "";
    for (const char of text.replace(/\t/g, "    ").replace(/\r/g, "")) {
      const stand = TRANSLITERATE[char];
      if (stand !== undefined && !this.charset.has(char.codePointAt(0) as number)) {
        out += stand;
        continue;
      }
      const code = char.codePointAt(0) as number;
      if (code === 0x200b || code === 0xfeff || code === 0x200d || (code >= 0xfe00 && code <= 0xfe0f)) continue; // invisible joiners
      if (char === "\n" || this.charset.has(code)) out += char;
      else {
        out += "?";
        this.replaced.set(char, (this.replaced.get(char) ?? 0) + 1);
      }
    }
    return out;
  }

  private newPage(): void {
    this.page = this.pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.y = PAGE_HEIGHT - MARGIN_TOP;
  }

  /** Starts a new page unless `height` still fits above the bottom margin. */
  ensure(height: number): void {
    if (this.y - height < MARGIN_BOTTOM) this.newPage();
  }

  gap(points: number): void {
    // Spacing at the very top of a page is dropped.
    if (this.y < PAGE_HEIGHT - MARGIN_TOP) this.y -= points;
  }

  forcePageBreak(): void {
    this.newPage();
  }

  /** Lays out styled atoms into wrapped lines; `marker` is drawn left of the first line. */
  paragraph(atoms: Atom[], frame: Frame, marker?: { text: string; font: PDFFont; size: number }): void {
    const lines = wrap(atoms, frame.width);
    if (lines.length === 0) lines.push([]);
    lines.forEach((line, index) => {
      const size = Math.max(BODY_SIZE, ...line.map(atom => atom.size));
      const lineHeight = size * LEADING;
      this.ensure(lineHeight);
      const baseline = this.y - size;
      for (const barX of frame.bars) {
        this.page.drawRectangle({ x: barX, y: this.y - lineHeight, width: 2, height: lineHeight, color: RULE });
      }
      if (index === 0 && marker) {
        const markerWidth = marker.font.widthOfTextAtSize(marker.text, marker.size);
        this.page.drawText(marker.text, { x: frame.x - 6 - markerWidth, y: baseline, size: marker.size, font: marker.font, color: TEXT });
      }
      let x = frame.x;
      for (const atom of line) {
        if (!atom.space) {
          this.page.drawText(atom.text, { x, y: baseline, size: atom.size, font: atom.font, color: atom.color });
          if (atom.href) {
            this.page.drawLine({ start: { x, y: baseline - 1.5 }, end: { x: x + atom.width, y: baseline - 1.5 }, thickness: 0.5, color: atom.color });
            this.link(x, baseline - 3, atom.width, atom.size + 3, atom.href);
          }
          if (atom.strike) {
            this.page.drawLine({
              start: { x, y: baseline + atom.size * 0.3 },
              end: { x: x + atom.width, y: baseline + atom.size * 0.3 },
              thickness: 0.5,
              color: atom.color,
            });
          }
        }
        x += atom.width;
      }
      this.y -= lineHeight;
    });
  }

  codeBlock(text: string, frame: Frame): void {
    const font = this.fonts.mono;
    const size = 9;
    const charWidth = font.widthOfTextAtSize("M", size);
    const perLine = Math.max(1, Math.floor((frame.width - 8) / charWidth));
    const lines: string[] = [];
    for (const raw of this.sanitize(text).split("\n")) {
      if (raw.length === 0) lines.push("");
      for (let i = 0; i < raw.length; i += perLine) lines.push(raw.slice(i, i + perLine));
    }
    const lineHeight = size * 1.35;
    for (const line of lines) {
      this.ensure(lineHeight);
      for (const barX of frame.bars) this.page.drawRectangle({ x: barX, y: this.y - lineHeight, width: 2, height: lineHeight, color: RULE });
      this.page.drawRectangle({ x: frame.x, y: this.y - lineHeight, width: frame.width, height: lineHeight, color: CODE_BG });
      if (line) this.page.drawText(line, { x: frame.x + 4, y: this.y - size - 0.5, size, font, color: TEXT });
      this.y -= lineHeight;
    }
  }

  /** One table row: every cell is already wrapped into lines. A row that does not fit the page moves to the next one. */
  tableRow(cells: Atom[][][], widths: number[], x: number, align: readonly string[], header: boolean): void {
    const pad = 4;
    const lineSize = (line: Atom[]) => Math.max(BODY_SIZE, ...line.map(atom => atom.size));
    const contentHeight = Math.max(BODY_SIZE * LEADING, ...cells.map(lines => lines.reduce((sum, line) => sum + lineSize(line) * LEADING, 0)));
    const height = contentHeight + pad * 2;
    this.ensure(height);
    const top = this.y;
    let cellX = x;
    cells.forEach((lines, col) => {
      const width = widths[col] ?? 0;
      this.page.drawRectangle({ x: cellX, y: top - height, width, height, borderColor: RULE, borderWidth: 0.5, ...(header ? { color: CODE_BG } : {}) });
      let lineTop = top - pad;
      for (const line of lines) {
        const size = lineSize(line);
        const used = line.reduce((sum, atom) => sum + atom.width, 0);
        const free = width - 2 * pad - used;
        let textX = cellX + pad + (align[col] === "right" ? free : align[col] === "center" ? free / 2 : 0);
        const baseline = lineTop - size;
        for (const atom of line) {
          if (!atom.space) {
            this.page.drawText(atom.text, { x: textX, y: baseline, size: atom.size, font: atom.font, color: atom.color });
            if (atom.href) {
              this.page.drawLine({
                start: { x: textX, y: baseline - 1.5 },
                end: { x: textX + atom.width, y: baseline - 1.5 },
                thickness: 0.5,
                color: atom.color,
              });
              this.link(textX, baseline - 3, atom.width, atom.size + 3, atom.href);
            }
          }
          textX += atom.width;
        }
        lineTop -= size * LEADING;
      }
      cellX += width;
    });
    this.y -= height;
  }

  rule(frame: Frame): void {
    this.ensure(10);
    this.y -= 4;
    this.page.drawLine({ start: { x: frame.x, y: this.y }, end: { x: frame.x + frame.width, y: this.y }, thickness: 0.75, color: RULE });
    this.y -= 6;
  }

  private link(x: number, y: number, width: number, height: number, href: string): void {
    let uri: string;
    try {
      uri = new URL(href).href;
    } catch {
      return;
    }
    if (!/^[\x20-\x7e]+$/.test(uri)) return;
    const annotation = this.pdf.context.obj({
      Type: "Annot",
      Subtype: "Link",
      Rect: [x, y, x + width, y + height],
      Border: [0, 0, 0],
      A: { Type: "Action", S: "URI", URI: PDFString.of(uri) },
    });
    const list = this.links.get(this.page) ?? [];
    list.push(this.pdf.context.register(annotation));
    this.links.set(this.page, list);
  }

  /** Attaches link annotations and the "Page n of N" footer to every page. */
  finish(): void {
    const pages = this.pdf.getPages();
    pages.forEach((page, index) => {
      const refs = this.links.get(page);
      if (refs?.length) page.node.set(PDFName.of("Annots"), this.pdf.context.obj(refs));
      const label = `Page ${index + 1} of ${pages.length}`;
      const size = 9;
      const width = this.fonts.regular.widthOfTextAtSize(label, size);
      page.drawText(label, { x: (PAGE_WIDTH - width) / 2, y: 36, size, font: this.fonts.regular, color: MUTED });
    });
  }
}

function fontFor(fonts: Fonts, run: Pick<Run, "bold" | "italic" | "code">, forceBold = false): PDFFont {
  if (run.code) return fonts.mono;
  const bold = run.bold || forceBold;
  if (bold && run.italic) return fonts.boldItalic;
  if (bold) return fonts.bold;
  return run.italic ? fonts.italic : fonts.regular;
}

/** Splits runs into words and spaces measured in their own font. */
function toAtoms(writer: Writer, runs: readonly Run[], opts: { size?: number; bold?: boolean; italic?: boolean; color?: ReturnType<typeof rgb> } = {}): Atom[] {
  const size = opts.size ?? BODY_SIZE;
  const atoms: Atom[] = [];
  for (const run of runs) {
    if (run.br) {
      atoms.push({ text: "", font: writer.fonts.regular, size, width: 0, space: true, color: TEXT, br: true });
      continue;
    }
    const font = fontFor(writer.fonts, { ...run, ...(opts.italic ? { italic: true } : {}) }, opts.bold);
    const runSize = run.code ? size * 0.9 : size;
    for (const part of writer.sanitize(run.text).split(/( +)/)) {
      if (!part) continue;
      const space = part[0] === " ";
      const text = space ? " " : part;
      atoms.push({
        text,
        font,
        size: runSize,
        width: font.widthOfTextAtSize(text, runSize),
        space,
        color: run.href ? LINK : (opts.color ?? TEXT),
        ...(run.href ? { href: run.href } : {}),
        ...(run.strike ? { strike: true } : {}),
      });
    }
  }
  return atoms;
}

/** Greedy word wrap; a word wider than the line is broken by characters. */
function wrap(atoms: readonly Atom[], width: number): Atom[][] {
  const lines: Atom[][] = [];
  let line: Atom[] = [];
  let used = 0;
  const flush = () => {
    while (line.length && line[line.length - 1]?.space) line.pop();
    lines.push(line);
    line = [];
    used = 0;
  };
  for (const atom of atoms) {
    if (atom.br) {
      flush();
      continue;
    }
    if (atom.space) {
      if (line.length) {
        line.push(atom);
        used += atom.width;
      }
      continue;
    }
    if (used + atom.width <= width) {
      line.push(atom);
      used += atom.width;
      continue;
    }
    if (line.length) flush();
    if (atom.width <= width) {
      line.push(atom);
      used = atom.width;
      continue;
    }
    // Longer than a whole line (a URL, say): split by characters.
    let piece = "";
    for (const char of atom.text) {
      const candidate = piece + char;
      if (piece && atom.font.widthOfTextAtSize(candidate, atom.size) > width) {
        line.push({ ...atom, text: piece, width: atom.font.widthOfTextAtSize(piece, atom.size) });
        flush();
        piece = char;
      } else piece = candidate;
    }
    if (piece) {
      line.push({ ...atom, text: piece, width: atom.font.widthOfTextAtSize(piece, atom.size) });
      used = line[0]?.width ?? 0;
    }
  }
  if (line.length) flush();
  return lines;
}

function layoutBlocks(writer: Writer, blocks: readonly Block[], frame: Frame, depth: number): void {
  for (const block of blocks) {
    switch (block.type) {
      case "heading": {
        const size = HEADING_SIZES[Math.min(5, block.depth - 1)] ?? BODY_SIZE;
        writer.gap(8);
        writer.ensure(size * LEADING * 2 + 8);
        writer.paragraph(toAtoms(writer, block.runs, { size, bold: true }), frame);
        writer.gap(3);
        break;
      }
      case "paragraph":
        writer.paragraph(toAtoms(writer, block.runs, frame.bars.length ? { color: MUTED, italic: true } : {}), frame);
        writer.gap(5);
        break;
      case "list": {
        const indent = 22;
        const inner: Frame = { x: frame.x + indent, width: frame.width - indent, bars: frame.bars };
        block.items.forEach((item, index) => {
          const label = block.ordered ? `${block.start + index}.` : depth % 2 === 0 ? "•" : "-";
          layoutListItem(writer, item, inner, label, depth);
        });
        writer.gap(3);
        break;
      }
      case "quote": {
        const inner: Frame = { x: frame.x + 14, width: frame.width - 14, bars: [...frame.bars, frame.x + 4] };
        layoutBlocks(writer, block.blocks, inner, depth);
        break;
      }
      case "code":
        writer.codeBlock(block.text, frame);
        writer.gap(6);
        break;
      case "table": {
        const length = (runs: Run[]) => runs.reduce((n, r) => n + r.text.length, 0);
        const weights = block.header.map((head, col) => Math.min(40, Math.max(6, Math.max(length(head), ...block.rows.map(row => length(row[col] ?? []))))));
        const total = weights.reduce((a, b) => a + b, 0) || 1;
        const widths = weights.map(w => (w / total) * frame.width);
        const lay = (runs: Run[], col: number, header: boolean) =>
          wrap(toAtoms(writer, runs, header ? { bold: true } : {}), Math.max(10, (widths[col] ?? 0) - 8));
        writer.tableRow(
          block.header.map((runs, col) => lay(runs, col, true)),
          widths,
          frame.x,
          block.align,
          true,
        );
        for (const row of block.rows)
          writer.tableRow(
            widths.map((_, col) => lay(row[col] ?? [], col, false)),
            widths,
            frame.x,
            block.align,
            false,
          );
        writer.gap(8);
        break;
      }
      case "rule":
        writer.rule(frame);
        break;
    }
  }
}

function layoutListItem(writer: Writer, item: readonly Block[], frame: Frame, label: string, depth: number): void {
  const [first, ...rest] = item;
  const marker = { text: writer.sanitize(label), font: writer.fonts.regular, size: BODY_SIZE };
  if (first?.type === "paragraph" || first?.type === "heading") {
    writer.paragraph(toAtoms(writer, first.runs, first.type === "heading" ? { bold: true } : {}), frame, marker);
    writer.gap(2);
  } else {
    writer.paragraph([], frame, marker);
    if (first) layoutBlocks(writer, [first], frame, depth + 1);
  }
  layoutBlocks(writer, rest, frame, depth + 1);
}

export async function renderPdf(document: BriefDocument): Promise<BriefFile> {
  const pdf = await PDFDocument.create();
  const fonts: Fonts = {
    regular: await pdf.embedFont(StandardFonts.Helvetica),
    bold: await pdf.embedFont(StandardFonts.HelveticaBold),
    italic: await pdf.embedFont(StandardFonts.HelveticaOblique),
    boldItalic: await pdf.embedFont(StandardFonts.HelveticaBoldOblique),
    mono: await pdf.embedFont(StandardFonts.Courier),
  };
  const writer = new Writer(pdf, fonts);
  const frame: Frame = { x: MARGIN_X, width: CONTENT_WIDTH, bars: [] };

  writer.paragraph(toAtoms(writer, [{ text: document.title }], { size: 24, bold: true }), frame);
  writer.gap(2);
  writer.paragraph(toAtoms(writer, [{ text: document.meta }], { size: 10, italic: true, color: MUTED }), frame);
  writer.gap(10);

  for (const section of document.sections) {
    writer.gap(14);
    writer.ensure(18 * LEADING + 60);
    writer.paragraph(toAtoms(writer, [{ text: section.name }], { size: 18, bold: true }), frame);
    writer.gap(4);
    layoutBlocks(writer, section.blocks, frame, 0);
    if (section.sourceNumbers.length) {
      writer.paragraph(toAtoms(writer, [{ text: sourcesPointer(section.sourceNumbers) }], { size: 10, italic: true, color: MUTED }), frame);
      writer.gap(4);
    }
  }

  if (document.references.length) {
    writer.forcePageBreak();
    writer.paragraph(toAtoms(writer, [{ text: "References" }], { size: 18, bold: true }), frame);
    writer.gap(6);
    document.references.forEach((source, index) => {
      const label = `[${index + 1}]`;
      const detail = referenceDetail(source);
      const runs: Run[] = [
        { text: referenceLabel(source), bold: true },
        ...(detail ? [{ text: ` — ${detail}` }] : []),
        { text: ". " },
        { text: source.url, href: source.url },
      ];
      writer.paragraph(toAtoms(writer, runs), { x: frame.x + 28, width: frame.width - 28, bars: [] }, { text: label, font: fonts.regular, size: BODY_SIZE });
      writer.gap(4);
    });
  }

  writer.finish();
  pdf.setTitle(writer.sanitize(document.title));
  pdf.setProducer("TokenRing One");
  pdf.setCreator("TokenRing One");

  const warnings = noteWarnings(document);
  if (writer.replaced.size) {
    const total = [...writer.replaced.values()].reduce((sum, n) => sum + n, 0);
    const sample = [...writer.replaced.keys()].slice(0, 8).join(" ");
    warnings.unshift(
      `${total} ${total === 1 ? "character" : "characters"} the PDF's standard fonts cannot show (${sample}${writer.replaced.size > 8 ? " …" : ""}) ${total === 1 ? "was" : "were"} replaced with "?". Use the Word export to keep them.`,
    );
  }
  return { bytes: await pdf.save(), warnings };
}

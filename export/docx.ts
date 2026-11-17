import {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
  Footer,
  HeadingLevel,
  LevelFormat,
  Packer,
  PageNumber,
  Paragraph,
  type ParagraphChild,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import { type BriefDocument, type BriefFile, noteWarnings, referenceDetail, referenceLabel, sourcesPointer } from "./briefDocument.ts";
import type { Block, Run } from "./markdownBlocks.ts";

const FONT = "Calibri";
const MONO = "Courier New";
const LINK_COLOR = "1155CC";
const MUTED = "595959";
const HEADINGS = [
  HeadingLevel.HEADING_1,
  HeadingLevel.HEADING_2,
  HeadingLevel.HEADING_3,
  HeadingLevel.HEADING_4,
  HeadingLevel.HEADING_5,
  HeadingLevel.HEADING_6,
];
const MAX_LEVELS = 9;

/** Characters XML 1.0 cannot carry; everything else (any script) is fine in DOCX. */
const XML_ILLEGAL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g;
const clean = (text: string) => text.replace(XML_ILLEGAL, "");

function textRun(run: Run, extra: { color?: string; italics?: boolean; bold?: boolean } = {}): TextRun {
  return new TextRun({
    text: clean(run.text),
    ...(run.bold || extra.bold ? { bold: true } : {}),
    ...(run.italic || extra.italics ? { italics: true } : {}),
    ...(run.strike ? { strike: true } : {}),
    ...(run.code ? { font: MONO, size: 20 } : {}),
    ...(run.href ? { color: LINK_COLOR, underline: {} } : extra.color ? { color: extra.color } : {}),
  });
}

function children(runs: readonly Run[], extra?: { color?: string; italics?: boolean; bold?: boolean }): ParagraphChild[] {
  const out: ParagraphChild[] = [];
  for (const run of runs) {
    if (run.br) out.push(new TextRun({ break: 1 }));
    else if (run.href) out.push(new ExternalHyperlink({ link: run.href, children: [textRun(run, extra)] }));
    else out.push(textRun(run, extra));
  }
  return out;
}

interface Context {
  /** Nesting level of the list the block sits in (-1 outside lists). */
  level: number;
  quote: number;
  /** Distinct numbering instance per ordered list so each restarts at its own start. */
  nextInstance: () => number;
  /** Paragraph options shared by the first paragraph of a list item. */
  marker?: { reference: string; level: number; instance?: number } | undefined;
}

type BodyChild = Paragraph | Table;

const PAGE_TEXT_WIDTH = 9360; // 6.5 inches in twentieths of a point

/** Column widths in proportion to the longest cell text (clamped), summing to the page width. */
function columnWidths(table: Extract<Block, { type: "table" }>): number[] {
  const length = (runs: Run[]) => runs.reduce((n, r) => n + r.text.length, 0);
  const weights = table.header.map((head, col) => {
    const longest = Math.max(length(head), ...table.rows.map(row => length(row[col] ?? [])));
    return Math.min(40, Math.max(6, longest));
  });
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  return weights.map(w => Math.floor((w / total) * PAGE_TEXT_WIDTH));
}

function tableFor(block: Extract<Block, { type: "table" }>): Table {
  const widths = columnWidths(block);
  const line = { style: BorderStyle.SINGLE, size: 4, color: "BBBBBB" };
  const borders = { top: line, bottom: line, left: line, right: line };
  const cell = (runs: Run[], col: number, header: boolean) =>
    new TableCell({
      borders,
      width: { size: widths[col] ?? 1000, type: WidthType.DXA },
      margins: { top: 60, bottom: 60, left: 100, right: 100 },
      ...(header ? { shading: { type: ShadingType.CLEAR, fill: "F2F2F2", color: "auto" } } : {}),
      children: [
        new Paragraph({
          alignment: block.align[col] === "right" ? AlignmentType.RIGHT : block.align[col] === "center" ? AlignmentType.CENTER : AlignmentType.LEFT,
          children: children(runs, header ? { bold: true } : undefined),
        }),
      ],
    });
  return new Table({
    width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    columnWidths: widths,
    rows: [
      new TableRow({ tableHeader: true, cantSplit: true, children: block.header.map((runs, col) => cell(runs, col, true)) }),
      ...block.rows.map(row => new TableRow({ cantSplit: true, children: widths.map((_, col) => cell(row[col] ?? [], col, false)) })),
    ],
  });
}

function convert(blocks: readonly Block[], ctx: Context): BodyChild[] {
  const out: BodyChild[] = [];
  let marker = ctx.marker;
  const indent = ctx.quote ? { left: 480 * ctx.quote } : undefined;
  const quoteBorder = ctx.quote ? { left: { style: BorderStyle.SINGLE, size: 12, space: 8, color: "BBBBBB" } } : undefined;
  const itemIndent = ctx.level >= 0 ? { left: 720 * (ctx.level + 1) } : undefined;

  for (const block of blocks) {
    switch (block.type) {
      case "heading": {
        out.push(
          new Paragraph({
            heading: HEADINGS[Math.min(5, block.depth - 1)] ?? HeadingLevel.HEADING_6,
            children: children(block.runs),
            spacing: { before: 200, after: 80 },
            keepNext: true,
          }),
        );
        break;
      }
      case "paragraph": {
        out.push(
          new Paragraph({
            children: children(block.runs, ctx.quote ? { color: MUTED, italics: true } : undefined),
            spacing: { after: 120 },
            ...(marker ? { numbering: marker } : itemIndent ? { indent: itemIndent } : indent ? { indent } : {}),
            ...(quoteBorder ? { border: quoteBorder } : {}),
          }),
        );
        marker = undefined;
        break;
      }
      case "list": {
        const level = Math.min(MAX_LEVELS - 1, ctx.level + 1);
        const reference = block.ordered ? "ordered" : "bullet";
        const instance = block.ordered ? ctx.nextInstance() : undefined;
        for (const item of block.items) {
          out.push(
            ...convert(item, {
              ...ctx,
              level,
              marker: { reference, level, ...(instance !== undefined ? { instance } : {}) },
            }),
          );
        }
        break;
      }
      case "quote":
        out.push(...convert(block.blocks, { ...ctx, quote: ctx.quote + 1, marker: undefined }));
        break;
      case "code":
        for (const line of block.text.replace(/\r/g, "").split("\n")) {
          out.push(
            new Paragraph({
              children: [new TextRun({ text: clean(line) || " ", font: MONO, size: 18 })],
              shading: { type: ShadingType.CLEAR, fill: "F2F2F2", color: "auto" },
              spacing: { after: 0 },
              indent: { left: (itemIndent?.left ?? 0) + (indent?.left ?? 0) },
              keepLines: true,
            }),
          );
        }
        out.push(new Paragraph({ spacing: { after: 80 }, children: [] }));
        break;
      case "table":
        out.push(tableFor(block), new Paragraph({ spacing: { after: 120 }, children: [] }));
        break;
      case "rule":
        out.push(
          new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 6, space: 1, color: "BBBBBB" } }, spacing: { after: 120 }, children: [] }),
        );
        break;
    }
  }
  return out;
}

function numberingLevels(format: "bullet" | "decimal") {
  return Array.from({ length: MAX_LEVELS }, (_, level) => ({
    level,
    format: format === "bullet" ? LevelFormat.BULLET : LevelFormat.DECIMAL,
    text: format === "bullet" ? (["•", "◦", "▪"][level % 3] as string) : `%${level + 1}.`,
    alignment: AlignmentType.LEFT,
    style: { paragraph: { indent: { left: 720 * (level + 1), hanging: 360 } } },
  }));
}

export async function renderDocx(document: BriefDocument): Promise<BriefFile> {
  let instances = 0;
  const nextInstance = () => ++instances;
  const body: BodyChild[] = [
    new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun({ text: clean(document.title) })] }),
    new Paragraph({ children: [new TextRun({ text: clean(document.meta), color: MUTED, italics: true })], spacing: { after: 240 } }),
  ];

  for (const section of document.sections) {
    body.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun({ text: clean(section.name) })],
        spacing: { before: 360, after: 120 },
        keepNext: true,
      }),
    );
    body.push(...convert(section.blocks, { level: -1, quote: 0, nextInstance }));
    if (section.sourceNumbers.length) {
      body.push(
        new Paragraph({
          children: [new TextRun({ text: sourcesPointer(section.sourceNumbers), italics: true, color: MUTED })],
          spacing: { before: 60, after: 120 },
        }),
      );
    }
  }

  if (document.references.length) {
    body.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun({ text: "References" })],
        spacing: { before: 360, after: 120 },
        pageBreakBefore: true,
      }),
    );
    document.references.forEach((source, index) => {
      const detail = referenceDetail(source);
      body.push(
        new Paragraph({
          indent: { left: 540, hanging: 540 },
          spacing: { after: 100 },
          children: [
            new TextRun({ text: `[${index + 1}]\t` }),
            new TextRun({ text: clean(referenceLabel(source)), bold: true }),
            ...(detail ? [new TextRun({ text: ` — ${clean(detail)}` })] : []),
            new TextRun({ text: ". " }),
            new ExternalHyperlink({ link: source.url, children: [new TextRun({ text: clean(source.url), color: LINK_COLOR, underline: {} })] }),
          ],
          tabStops: [{ type: "left", position: 540 }],
        }),
      );
    });
  }

  const doc = new Document({
    creator: "TokenRing One",
    title: clean(document.title),
    styles: { default: { document: { run: { font: FONT, size: 22 } } } },
    numbering: {
      config: [
        { reference: "bullet", levels: numberingLevels("bullet") },
        { reference: "ordered", levels: numberingLevels("decimal") },
      ],
    },
    sections: [
      {
        properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ children: ["Page ", PageNumber.CURRENT, " of ", PageNumber.TOTAL_PAGES], color: MUTED, size: 18 })],
              }),
            ],
          }),
        },
        children: body,
      },
    ],
  });

  return { bytes: new Uint8Array(await Packer.toBuffer(doc)), warnings: noteWarnings(document) };
}

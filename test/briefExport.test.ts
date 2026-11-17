import { afterEach, describe, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { inflateRawSync, inflateSync } from "node:zlib";
import { PDFDict, PDFDocument, PDFName, PDFString, StandardFonts } from "pdf-lib";
import { buildBriefDocument } from "../export/briefDocument.ts";
import { parseMarkdown, type RenderNotes } from "../export/markdownBlocks.ts";
import ResearchService from "../ResearchService.ts";
import ResearchRpcSchema from "../rpc/schema.ts";
import { ResearchServiceConfigSchema } from "../schema.ts";

const tempDirs: string[] = [];
afterEach(() => {
  for (const dir of tempDirs) fs.rmSync(dir, { recursive: true, force: true });
  tempDirs.length = 0;
});

function setup() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tr-research-export-"));
  tempDirs.push(dir);
  const service = new ResearchService(ResearchServiceConfigSchema.parse({ agentDefaults: { researchDirectory: dir } }));
  return { dir, service };
}

const ACME = { url: "https://acme.example/report", title: "Annual report", publisher: "ACME Corp", accessed: "2026-11-01" };
const NEWS = { url: "https://news.example/story", accessed: "2026-11-02" };
const EXPORTED_AT = "2026-11-16T00:00:00.000Z";

/** Reads one entry of a zip (stored or deflated) without a zip library. */
function zipEntries(bytes: Uint8Array): Map<string, string> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = bytes.length - 22;
  while (eocd >= 0 && view.getUint32(eocd, true) !== 0x06054b50) eocd--;
  expect(eocd).toBeGreaterThanOrEqual(0);
  const count = view.getUint16(eocd + 10, true);
  let offset = view.getUint32(eocd + 16, true);
  const decoder = new TextDecoder();
  const out = new Map<string, string>();
  for (let i = 0; i < count; i++) {
    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    const name = decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength));
    const dataStart = localOffset + 30 + view.getUint16(localOffset + 26, true) + view.getUint16(localOffset + 28, true);
    const raw = bytes.subarray(dataStart, dataStart + compressedSize);
    out.set(name, decoder.decode(method === 0 ? raw : inflateRawSync(raw)));
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return out;
}

/** Strings drawn with Tj: standard-font text is hex WinAnsi codes inside Flate-compressed content streams. */
function pdfStrings(bytes: Uint8Array): string[] {
  const text = Buffer.from(bytes).toString("latin1");
  const out: string[] = [];
  for (const stream of text.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
    let content: string;
    try {
      content = inflateSync(Buffer.from(stream[1] as string, "latin1")).toString("latin1");
    } catch {
      continue; // not a Flate stream
    }
    for (const match of content.matchAll(/<([0-9A-Fa-f]+)>\s*Tj/g)) out.push(Buffer.from(match[1] as string, "hex").toString("latin1"));
  }
  return out;
}

/** URIs of the link annotations on every page. */
function pdfLinks(pdf: PDFDocument): string[] {
  const uris: string[] = [];
  for (const page of pdf.getPages()) {
    const annots = page.node.Annots();
    for (let i = 0; i < (annots?.size() ?? 0); i++) {
      const action = annots?.lookup(i, PDFDict).lookup(PDFName.of("A"), PDFDict);
      uris.push(action?.lookup(PDFName.of("URI"), PDFString).decodeText() ?? "");
    }
  }
  return uris;
}

async function seededService() {
  const { dir, service } = setup();
  await service.updateItem(dir, "client", "a-summary", "# Summary\n\nSome **bold** text with a [link](https://example.com/x).\n\n- first\n- second\n", {
    sources: [ACME, NEWS],
  });
  await service.updateItem(dir, "client", "b-detail", "Plain detail.\n", { sources: [{ ...ACME, title: "Ignored duplicate title" }] });
  await service.setTopicTags(dir, "client", ["acme", "q4"]);
  return { dir, service };
}

describe("exportBrief formats", () => {
  test("Markdown result keeps its original shape", async () => {
    const { dir, service } = await seededService();
    const result = await service.exportBrief(dir, "client", EXPORTED_AT);
    expect(Object.keys(result).sort()).toEqual(["content", "fileName", "itemCount", "sourceCount"]);
    expect(result).toMatchObject({ fileName: "client-brief.md", itemCount: 2, sourceCount: 2 });
    expect(result.content).toContain("## References");
  });

  test("the RPC schema defaults to Markdown and accepts both result shapes", () => {
    const method = ResearchRpcSchema.methods.exportBrief;
    expect(method.input.parse({ topicName: "t" })).toEqual({ topicName: "t" });
    expect(method.input.parse({ topicName: "t", format: "pdf" })).toEqual({ topicName: "t", format: "pdf" });
    expect(() => method.input.parse({ topicName: "t", format: "rtf" })).toThrow();
    expect(method.result.parse({ fileName: "a.md", content: "#", itemCount: 1, sourceCount: 0 })).toEqual({
      fileName: "a.md",
      content: "#",
      itemCount: 1,
      sourceCount: 0,
    });
    const binary = { fileName: "a.pdf", mimeType: "application/pdf", contentBase64: "UEs=", itemCount: 1, sourceCount: 0, warnings: [] };
    expect(method.result.parse(binary)).toEqual(binary);
  });

  test("docx is a zip with the brief's text, a numbered de-duplicated reference list and links", async () => {
    const { dir, service } = await seededService();
    const result = await service.exportBriefFile(dir, "client", "docx", EXPORTED_AT);
    expect(result).toMatchObject({
      fileName: "client-brief.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      itemCount: 2,
      sourceCount: 2,
      warnings: [],
    });
    const bytes = Buffer.from(result.contentBase64, "base64");
    expect([...bytes.subarray(0, 2)]).toEqual([0x50, 0x4b]);

    const entries = zipEntries(bytes);
    expect([...entries.keys()]).toEqual(expect.arrayContaining(["word/document.xml", "word/footer1.xml", "word/numbering.xml", "[Content_Types].xml"]));
    const xml = entries.get("word/document.xml") as string;
    for (const text of [
      "client",
      "Exported 2026-11-16 · Tags: acme, q4 · 2 dossiers",
      "a-summary",
      "b-detail",
      "Summary",
      "bold",
      "first",
      "second",
      "Plain detail.",
    ]) {
      expect(xml).toContain(text);
    }
    expect(xml).toContain("Sources: [1], [2]");
    expect(xml).toContain("Sources: [1]");
    expect(xml).toContain("References");
    expect(xml).toContain("[1]");
    expect(xml).toContain("[2]");
    expect(xml).not.toContain("[3]");
    expect(xml).not.toContain("Ignored duplicate title");
    // Two references, each URL once as visible text.
    expect(xml.match(/>https:\/\/acme\.example\/report</g)).toHaveLength(1);
    expect(xml.match(/>https:\/\/news\.example\/story</g)).toHaveLength(1);
    expect(xml).toContain("w:hyperlink");
    const rels = entries.get("word/_rels/document.xml.rels") as string;
    expect(rels).toContain("https://acme.example/report");
    expect(rels).toContain("https://example.com/x");
    expect(entries.get("word/footer1.xml")).toContain("PAGE");
  });

  test("docx keeps non-Latin text and drops characters XML cannot hold", async () => {
    const { dir, service } = setup();
    await service.createItem(dir, "t", "a", "日本語 and Ωmega \u0001 end\n");
    const result = await service.exportBriefFile(dir, "t", "docx", EXPORTED_AT);
    expect(result.warnings).toEqual([]);
    const xml = zipEntries(Buffer.from(result.contentBase64, "base64")).get("word/document.xml") as string;
    expect(xml).toContain("日本語 and Ωmega");
    expect(xml).not.toContain("\u0001");
  });

  test("pdf parses, carries a page-number footer and the references", async () => {
    const { dir, service } = await seededService();
    const result = await service.exportBriefFile(dir, "client", "pdf", EXPORTED_AT);
    expect(result).toMatchObject({ fileName: "client-brief.pdf", mimeType: "application/pdf", itemCount: 2, sourceCount: 2, warnings: [] });
    const bytes = Buffer.from(result.contentBase64, "base64");
    expect(bytes.subarray(0, 5).toString("latin1")).toBe("%PDF-");

    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBeGreaterThanOrEqual(2); // references start on their own page
    expect(pdf.getTitle()).toBe("client");
    const strings = pdfStrings(bytes);
    const joined = strings.join(" "); // words are drawn one by one; spaces are gaps
    expect(strings).toContain(`Page 1 of ${pdf.getPageCount()}`);
    expect(strings).toContain(`Page ${pdf.getPageCount()} of ${pdf.getPageCount()}`);
    for (const text of ["client", "a-summary", "Summary", "References", "Annual report", "https://acme.example/report", "https://news.example/story"]) {
      expect(joined).toContain(text);
    }
    expect(joined).toContain("Sources: [1], [2]");
    // The links are real annotations.
    expect(pdfLinks(pdf)).toEqual(expect.arrayContaining(["https://acme.example/report", "https://news.example/story", "https://example.com/x"]));
  });

  test("pdf wraps long lines inside the margins and paginates a long brief", async () => {
    const { dir, service } = setup();
    const long = Array.from({ length: 400 }, (_, i) => `Sentence number ${i} keeps this paragraph long enough to wrap.`).join(" ");
    await service.createItem(dir, "t", "long", `${long}\n\n${"A".repeat(300)}\n\n${"x".repeat(40)} https://example.com/${"segment/".repeat(40)}\n`);
    const result = await service.exportBriefFile(dir, "t", "pdf", EXPORTED_AT);
    const bytes = Buffer.from(result.contentBase64, "base64");
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBeGreaterThan(3);

    const font = await (await PDFDocument.create()).embedFont(StandardFonts.Helvetica);
    const widest = Math.max(...pdfStrings(bytes).map(text => font.widthOfTextAtSize(text, 11)));
    expect(widest).toBeLessThanOrEqual(612 - 2 * 72 + 0.5);
    // The 300-character word was broken across several drawn pieces.
    expect(pdfStrings(bytes).filter(text => /^A+$/.test(text)).length).toBeGreaterThan(1);
    for (let page = 1; page <= pdf.getPageCount(); page++) expect(pdfStrings(bytes)).toContain(`Page ${page} of ${pdf.getPageCount()}`);
  });

  test("tables are real tables in Word and drawn cells in the PDF, with no warning", async () => {
    const { dir, service } = setup();
    await service.createItem(dir, "t", "grid", "| Name | Qty |\n|:--|--:|\n| apple | 10 |\n| fig | 2 |\n");
    const docx = await service.exportBriefFile(dir, "t", "docx", EXPORTED_AT);
    expect(docx.warnings).toEqual([]);
    const xml = zipEntries(Buffer.from(docx.contentBase64, "base64")).get("word/document.xml") ?? "";
    expect(xml).toContain("<w:tbl>");
    expect(xml.match(/<w:tr[ >]/g)?.length).toBe(3);
    expect(xml).toContain("<w:tblHeader");
    const pdf = await service.exportBriefFile(dir, "t", "pdf", EXPORTED_AT);
    expect(pdf.warnings).toEqual([]);
    const strings = pdfStrings(Buffer.from(pdf.contentBase64, "base64"));
    for (const cell of ["Name", "Qty", "apple", "10", "fig", "2"]) expect(strings).toContain(cell);
  });

  test("pdf swaps common symbols for ASCII without a warning", async () => {
    const { dir, service } = setup();
    await service.createItem(dir, "t", "sym", "A → B ✓ and x ≥ 2\n");
    const result = await service.exportBriefFile(dir, "t", "pdf", EXPORTED_AT);
    expect(result.warnings).toEqual([]);
    expect(pdfStrings(Buffer.from(result.contentBase64, "base64")).join(" ")).toContain("A -> B v and x >= 2");
  });

  test("pdf replaces characters the standard fonts cannot encode and reports them", async () => {
    const { dir, service } = setup();
    await service.createItem(dir, "t", "a", "Café — “quoted” • 日本語 😀 done\n");
    const result = await service.exportBriefFile(dir, "t", "pdf", EXPORTED_AT);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain("4 characters");
    expect(result.warnings[0]).toContain("日");
    expect(result.warnings[0]).toContain("?");
    const strings = pdfStrings(Buffer.from(result.contentBase64, "base64"));
    expect(strings.join(" ")).toContain("??? ?");
    expect(strings).toContain("Café"); // WinAnsi characters survive
  });

  test("unknown topics fail the same way for every format", async () => {
    const { dir, service } = setup();
    await expect(service.exportBriefFile(dir, "nope", "pdf")).rejects.toThrow("not found");
    await expect(service.exportBriefFile(dir, "nope", "docx")).rejects.toThrow("not found");
  });

  test("an empty topic still exports", async () => {
    const { dir, service } = setup();
    await service.createTopic(dir, "empty");
    for (const format of ["docx", "pdf"] as const) {
      const result = await service.exportBriefFile(dir, "empty", format, EXPORTED_AT);
      expect(result).toMatchObject({ itemCount: 0, sourceCount: 0 });
    }
  });
});

describe("markdown rendering model", () => {
  const parse = (markdown: string, shift = 1) => {
    const notes: RenderNotes = { images: 0 };
    return { blocks: parseMarkdown(markdown, notes, shift), notes };
  };

  test("headings are demoted under the item heading and capped at level 6", () => {
    const { blocks } = parse("# One\n\n## Two\n\n###### Six");
    expect(blocks.map(block => (block.type === "heading" ? block.depth : 0))).toEqual([2, 3, 6]);
  });

  test("inline formatting becomes styled runs", () => {
    const { blocks } = parse("Plain **bold** _italic_ `code` ~~gone~~ ***both***");
    expect(blocks[0]).toEqual({
      type: "paragraph",
      runs: [
        { text: "Plain " },
        { text: "bold", bold: true },
        { text: " " },
        { text: "italic", italic: true },
        { text: " " },
        { text: "code", code: true },
        { text: " " },
        { text: "gone", strike: true },
        { text: " " },
        { text: "both", bold: true, italic: true },
      ],
    });
  });

  test("bullet, numbered, nested and task lists", () => {
    const { blocks } = parse("1. one\n2. two\n   - nested\n\n- [x] done\n- [ ] todo");
    const [ordered, bullets] = blocks;
    expect(ordered).toMatchObject({ type: "list", ordered: true, start: 1 });
    expect(ordered?.type === "list" && ordered.items).toHaveLength(2);
    const second = ordered?.type === "list" ? ordered.items[1] : [];
    expect(second?.[1]).toMatchObject({ type: "list", ordered: false });
    expect(bullets?.type === "list" && bullets.items.map(item => (item[0]?.type === "paragraph" ? item[0].runs[0]?.text : ""))).toEqual(["[x] ", "[ ] "]);
  });

  test("an ordered list keeps its start number", () => {
    expect(parse("3. three\n4. four").blocks[0]).toMatchObject({ type: "list", ordered: true, start: 3 });
  });

  test("links keep http(s) URLs and drop unsafe ones", () => {
    const { blocks } = parse("[good](https://example.com/a) and [bad](javascript:alert(1))");
    const runs = blocks[0]?.type === "paragraph" ? blocks[0].runs : [];
    expect(runs[0]).toEqual({ text: "good", href: "https://example.com/a" });
    expect(runs.find(run => run.text === "bad")).toEqual({ text: "bad" });
  });

  test("block quotes, code blocks and rules", () => {
    const { blocks } = parse("> quoted\n> text\n\n```ts\nconst a = 1;\n```\n\n---");
    expect(blocks.map(block => block.type)).toEqual(["quote", "code", "rule"]);
    expect(blocks[1]).toEqual({ type: "code", text: "const a = 1;" });
  });

  test("images are skipped with their alt text and counted; tables become table blocks", () => {
    const { blocks, notes } = parse("![A chart](https://example.com/c.png)\n\n| Name | Qty |\n|------|-----|\n| apple | 10 |\n| fig | 2 |");
    expect(blocks[0]).toMatchObject({ type: "paragraph", runs: [{ text: "[image: A chart]", italic: true }] });
    expect(blocks[1]).toMatchObject({
      type: "table",
      header: [[{ text: "Name" }], [{ text: "Qty" }]],
      rows: [
        [[{ text: "apple" }], [{ text: "10" }]],
        [[{ text: "fig" }], [{ text: "2" }]],
      ],
    });
    expect(notes).toEqual({ images: 1 });
  });

  test("the brief document numbers references once per URL and warns about skipped content", () => {
    const document = buildBriefDocument(
      "t",
      [],
      [
        { name: "a", content: "![x](https://e.com/i.png)", sources: [ACME, NEWS] },
        { name: "b", content: "text", sources: [ACME] },
      ],
      EXPORTED_AT,
    );
    expect(document.references.map(ref => ref.url)).toEqual([ACME.url, NEWS.url]);
    expect(document.sections.map(section => section.sourceNumbers)).toEqual([[1, 2], [1]]);
    expect(document.meta).toBe("Exported 2026-11-16 · 2 dossiers");
    expect(document.notes.images).toBe(1);
  });
});

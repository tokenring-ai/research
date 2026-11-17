import { z } from "zod";

/** Most sources one item keeps. */
export const MAX_SOURCES = 100;

function isHttpUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

const UrlSchema = z.string().trim().refine(isHttpUrl, { message: "url must be an absolute http(s) URL" });

/** A source as stored and returned. `accessed` is a YYYY-MM-DD date, absent only in hand-written files. */
export const SourceSchema = z.object({
  url: UrlSchema,
  title: z.string().exactOptional(),
  publisher: z.string().exactOptional(),
  accessed: z.string().exactOptional(),
});
export type Source = z.output<typeof SourceSchema>;

/** A source as supplied by a caller (tool or RPC); `accessed` defaults to today when written. */
export const SourceInputSchema = z.object({
  url: UrlSchema.describe("The http(s) URL that was actually read"),
  title: z.string().trim().min(1).exactOptional().describe("Title of the page or document"),
  publisher: z.string().trim().min(1).exactOptional().describe("Publisher or site name"),
  accessed: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "accessed must be YYYY-MM-DD")
    .exactOptional()
    .describe("Date the source was read (YYYY-MM-DD); defaults to today"),
});
export type SourceInput = z.input<typeof SourceInputSchema>;

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Validates caller-supplied sources, fills `accessed`, and drops repeated URLs (first wins). */
export function normalizeSources(inputs: readonly SourceInput[], now: string = today()): Source[] {
  const byUrl = new Map<string, Source>();
  for (const input of inputs) {
    const parsed = SourceInputSchema.parse(input);
    const key = urlKey(parsed.url);
    if (byUrl.has(key)) continue;
    byUrl.set(key, {
      url: parsed.url,
      ...(parsed.title ? { title: parsed.title } : {}),
      ...(parsed.publisher ? { publisher: parsed.publisher } : {}),
      accessed: parsed.accessed ?? now,
    });
  }
  if (byUrl.size > MAX_SOURCES) throw new Error(`An item can carry at most ${MAX_SOURCES} sources`);
  return [...byUrl.values()];
}

/** Identity of a URL for de-duplication. */
export function urlKey(url: string): string {
  try {
    return new URL(url).href;
  } catch {
    return url;
  }
}

export interface BriefItem {
  name: string;
  content: string;
  sources: readonly Source[];
}

function describeReference(source: Source, index: number): string {
  let host = source.url;
  try {
    host = new URL(source.url).host;
  } catch {}
  const label = source.title ?? host;
  const publisher = source.publisher ? ` — ${source.publisher}` : "";
  const accessed = source.accessed ? ` (accessed ${source.accessed})` : "";
  return `${index + 1}. ${label}${publisher}. <${source.url}>${accessed}`;
}

/**
 * Numbers the sources of every item for a brief: one number per distinct URL in
 * order of first appearance (first title and publisher win). `numbers[i]` lists
 * the reference numbers item `i` cites, without repeats.
 */
export function numberReferences(items: readonly { sources: readonly Source[] }[]): { references: Source[]; numbers: number[][] } {
  const references: Source[] = [];
  const numberByUrl = new Map<string, number>();
  const numbers = items.map(item => {
    const own: number[] = [];
    for (const source of item.sources) {
      const key = urlKey(source.url);
      let number = numberByUrl.get(key);
      if (number === undefined) {
        references.push(source);
        number = references.length;
        numberByUrl.set(key, number);
      }
      if (!own.includes(number)) own.push(number);
    }
    return own;
  });
  return { references, numbers };
}

/**
 * A topic as one client-ready Markdown document: every item under `## <name>`
 * (text untouched, with a "Sources: [n]" pointer line when it has sources),
 * then a numbered "References" list de-duplicated by URL (first title and
 * publisher win). `exportedAt` is injected so output is reproducible.
 */
export function buildBrief(
  topicName: string,
  tags: readonly string[],
  items: readonly BriefItem[],
  exportedAt: string,
): { content: string; sourceCount: number } {
  const { references, numbers: itemNumbers } = numberReferences(items);
  const sections = items.map((item, index) => {
    const numbers = itemNumbers[index] ?? [];
    const pointer = numbers.length ? `\n_Sources: ${numbers.map(n => `[${n}]`).join(", ")}_\n` : "";
    return `## ${item.name}\n\n${item.content.trim()}\n${pointer}`;
  });

  const tagLine = tags.length ? ` · Tags: ${tags.join(", ")}` : "";
  const header = `# ${topicName}\n\n_Exported ${exportedAt}${tagLine} · ${items.length} ${items.length === 1 ? "dossier" : "dossiers"}_\n`;
  const parts = [header, ...sections];
  if (references.length) parts.push(`## References\n\n${references.map(describeReference).join("\n")}\n`);
  return { content: parts.join("\n---\n\n"), sourceCount: references.length };
}

import { YAML } from "bun";
import { z } from "zod";
import { type Source, SourceSchema } from "./sources.ts";

/**
 * Reading and writing an item's frontmatter. Kept apart from `sources.ts` because this file needs Bun's YAML,
 * and `sources.ts` is imported by the RPC schema, which the browser bundle includes.
 */

export interface ParsedItemText {
  /** The Markdown without its frontmatter block. */
  body: string;
  sources: Source[];
  /** Set when a frontmatter block was present but unusable; `body` is then the raw file text. */
  warning?: string;
}

const OPEN = /^---[ \t]*\r?\n/;
const CLOSE = /^---[ \t]*$/m;

/**
 * Splits optional YAML frontmatter (`sources:` list) from a markdown file.
 * Files without it, or whose leading `---` block is not a mapping with a
 * `sources` key (e.g. a horizontal rule), come back untouched. A block that
 * cannot be parsed never throws: the raw text is returned with a warning.
 */
export function parseItemText(raw: string): ParsedItemText {
  const open = OPEN.exec(raw);
  if (!open) return { body: raw, sources: [] };
  const rest = raw.slice(open[0].length);
  const close = CLOSE.exec(rest);
  if (!close) return { body: raw, sources: [] };

  const yamlText = rest.slice(0, close.index);
  const afterClose = rest.slice(close.index + close[0].length);
  const body = afterClose.replace(/^\r?\n/, "");

  let data: unknown;
  try {
    data = YAML.parse(yamlText);
  } catch (error) {
    return {
      body: raw,
      sources: [],
      warning: `Frontmatter could not be parsed (${error instanceof Error ? error.message.split("\n")[0] : "invalid YAML"}); showing the raw text.`,
    };
  }
  if (data === null || typeof data !== "object" || Array.isArray(data) || !("sources" in data)) return { body: raw, sources: [] };

  const result = z.array(SourceSchema).safeParse((data as { sources: unknown }).sources);
  if (!result.success) {
    return { body: raw, sources: [], warning: `Frontmatter sources are invalid (${result.error.issues[0]?.message ?? "bad entry"}); showing the raw text.` };
  }
  return { body, sources: result.data };
}

/** Inverse of `parseItemText`: no sources means the body is written exactly as given. */
export function emitItemText(body: string, sources: readonly Source[]): string {
  if (sources.length === 0) return body;
  const entries = sources.map(source => ({
    url: source.url,
    ...(source.title ? { title: source.title } : {}),
    ...(source.publisher ? { publisher: source.publisher } : {}),
    ...(source.accessed ? { accessed: source.accessed } : {}),
  }));
  return `---\n${YAML.stringify({ sources: entries }, null, 2).replace(/\n*$/, "\n")}---\n${body}`;
}

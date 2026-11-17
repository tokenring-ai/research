import { type BriefItem, numberReferences, type Source } from "../sources.ts";
import { type Block, parseMarkdown, type RenderNotes } from "./markdownBlocks.ts";

export type BriefFormat = "md" | "docx" | "pdf";

export interface BriefSection {
  name: string;
  blocks: Block[];
  /** Reference numbers this item cites. */
  sourceNumbers: number[];
}

/** Everything a writer needs; the same model feeds the DOCX and the PDF so they cannot drift apart. */
export interface BriefDocument {
  title: string;
  /** "Exported 2026-11-16 · Tags: a, b · 3 dossiers" */
  meta: string;
  sections: BriefSection[];
  references: Source[];
  notes: RenderNotes;
}

export interface BriefFile {
  bytes: Uint8Array;
  warnings: string[];
}

export function buildBriefDocument(topicName: string, tags: readonly string[], items: readonly BriefItem[], exportedAt: string): BriefDocument {
  const notes: RenderNotes = { images: 0 };
  const { references, numbers } = numberReferences(items);
  const sections = items.map((item, index) => ({
    name: item.name,
    blocks: parseMarkdown(item.content.trim(), notes),
    sourceNumbers: numbers[index] ?? [],
  }));
  const tagLine = tags.length ? ` · Tags: ${tags.join(", ")}` : "";
  const meta = `Exported ${exportedAt.slice(0, 10)}${tagLine} · ${items.length} ${items.length === 1 ? "dossier" : "dossiers"}`;
  return { title: topicName, meta, sections, references, notes };
}

/** Warnings shared by every format. */
export function noteWarnings(document: BriefDocument): string[] {
  const warnings: string[] = [];
  const { images } = document.notes;
  if (images) warnings.push(`${images} ${images === 1 ? "image was" : "images were"} left out (their alt text is shown instead).`);
  return warnings;
}

export function referenceLabel(source: Source): string {
  let host = source.url;
  try {
    host = new URL(source.url).host;
  } catch {}
  return source.title ?? host;
}

/** "Publisher · accessed 2026-11-01", or "" when neither is known. */
export function referenceDetail(source: Source): string {
  return [source.publisher, source.accessed ? `accessed ${source.accessed}` : undefined].filter(Boolean).join(" · ");
}

export function sourcesPointer(numbers: readonly number[]): string {
  return `Sources: ${numbers.map(n => `[${n}]`).join(", ")}`;
}

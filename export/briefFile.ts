import type { BriefItem } from "../sources.ts";
import { type BriefFile, type BriefFormat, buildBriefDocument } from "./briefDocument.ts";

export const BRIEF_MIME_TYPES = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pdf: "application/pdf",
} as const;

/**
 * Renders a brief as DOCX or PDF. The writers (and their libraries) load on first use, so topics
 * exported as Markdown never pay for them.
 */
export async function renderBriefFile(
  format: Exclude<BriefFormat, "md">,
  topicName: string,
  tags: readonly string[],
  items: readonly BriefItem[],
  exportedAt: string,
): Promise<BriefFile> {
  const document = buildBriefDocument(topicName, tags, items, exportedAt);
  if (format === "docx") return (await import("./docx.ts")).renderDocx(document);
  return (await import("./pdf.ts")).renderPdf(document);
}

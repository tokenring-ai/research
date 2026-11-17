/** Most tags a topic keeps; extras are dropped. */
export const MAX_TAGS = 10;
/** Longest a single tag may be; longer ones are cut. */
export const MAX_TAG_LENGTH = 32;

/** Trims, lowercases, collapses inner whitespace, drops empties, dedupes (first wins) and caps the count. */
export function normalizeTags(input: readonly string[]): string[] {
  const seen = new Set<string>();
  for (const raw of input) {
    const tag = raw.trim().toLowerCase().replace(/\s+/g, " ").slice(0, MAX_TAG_LENGTH).trim();
    if (tag) seen.add(tag);
    if (seen.size >= MAX_TAGS) break;
  }
  return [...seen];
}

/** Splits free text such as "acme, q4 review" into tags and normalises them. */
export function parseTagInput(text: string): string[] {
  return normalizeTags(text.split(/[,\n]/));
}

/** Topics carrying every one of `activeTags` (all of them when none are active). */
export function filterTopicsByTags<T extends { tags: readonly string[] }>(topics: readonly T[], activeTags: readonly string[]): T[] {
  if (activeTags.length === 0) return [...topics];
  return topics.filter(topic => activeTags.every(tag => topic.tags.includes(tag)));
}

/** Topics whose name or any tag contains `query` (case-insensitive). */
export function matchTopics<T extends { name: string; tags: readonly string[] }>(topics: readonly T[], query: string): T[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  return topics.filter(topic => topic.name.toLowerCase().includes(needle) || topic.tags.some(tag => tag.includes(needle)));
}

/** React-free route helpers and constants shared by the dashboard definition and the views. */

export const RESEARCH_ROOT = "/research";

/** Topic and item names map onto directory / file names on disk. */
export const NAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/;

/** Seed content for a dossier created from the navigator. */
export const DEFAULT_MARKDOWN = `# Research Notes

Start writing your findings here, or launch an agent below to research a topic and save markdown items into a research topic.
`;

export function researchItemPath(topicName: string, itemName: string): string {
  return `${RESEARCH_ROOT}/${encodeURIComponent(topicName)}/${encodeURIComponent(itemName)}`;
}

/** Stable key for one dossier, used for drafts and panel instances. */
export function researchItemKey(topicName: string, itemName: string): string {
  return `${topicName}/${itemName}`;
}

import type { Dirent } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import type Agent from "@tokenring-ai/agent/Agent";
import type { AgentCreationContext } from "@tokenring-ai/agent/types";
import type { TokenRingService } from "@tokenring-ai/app/types";
import deepClone from "@tokenring-ai/utility/object/deepClone";
import {
  type Item,
  type ItemSearchResult,
  type ItemSummary,
  type ParsedResearchConfig,
  ResearchAgentConfigSchema,
  ResearchServiceConfigSchema,
  type TopicSummary,
} from "./schema.ts";
import { ResearchState } from "./state/ResearchState.ts";

const NAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/;
const EXTENSION = ".md";
const SNIPPET_RADIUS = 80;

/** First Markdown heading of a dossier, used as its title. */
function extractTitle(content: string): string | null {
  const match = /^#{1,6}[ \t]+(.+?)[ \t#]*$/m.exec(content);
  return match?.[1]?.trim() || null;
}

function countOccurrences(haystack: string, needle: string): number {
  let count = 0;
  for (let at = haystack.indexOf(needle); at !== -1; at = haystack.indexOf(needle, at + needle.length)) count++;
  return count;
}

/** One-line excerpt around `index` (or the start of the text), with ellipses where it was cut. */
function makeSnippet(content: string, index: number, length: number): string {
  const start = Math.max(0, index - SNIPPET_RADIUS);
  const end = Math.min(content.length, index + length + SNIPPET_RADIUS);
  const body = content.slice(start, end).replace(/\s+/g, " ").trim();
  return `${start > 0 ? "…" : ""}${body}${end < content.length ? "…" : ""}`;
}

function assertValidName(name: string, kind: "topic" | "item"): void {
  if (!NAME_PATTERN.test(name)) {
    throw new Error(
      `Invalid ${kind} name "${name}". Names must start with a letter or number and may only contain letters, numbers, hyphens, and underscores.`,
    );
  }
}

async function pathExists(target: string): Promise<boolean> {
  return fs
    .access(target)
    .then(() => true)
    .catch(() => false);
}

/**
 * Manages research topics and markdown items on disk under a research directory.
 *
 * Layout: `<researchDirectory>/<topic>/<item>.md`
 */
export default class ResearchService implements TokenRingService {
  readonly name = "ResearchService";
  description = "Research topics and markdown items, backed by files on disk";

  private options = ResearchServiceConfigSchema.parse({});

  constructor(options?: ParsedResearchConfig) {
    if (options) this.options = options;
  }

  reconfigure(options: ParsedResearchConfig): void {
    this.options = options;
  }

  /** Agent types configured for research (from ResearchServiceConfigSchema.agentTypes). */
  getAgentTypes(): string[] {
    return [...this.options.agentTypes];
  }

  attach(agent: Agent, creationContext: AgentCreationContext): void {
    const agentConfig = deepClone(this.options.agentDefaults, agent.getAgentConfigSlice("research", ResearchAgentConfigSchema));
    const initialState = agent.initializeState(ResearchState, agentConfig);
    creationContext.items.push(`Research Directory: ${initialState.researchDirectory}`);
  }

  getDefaultResearchDirectory(): string {
    return this.options.agentDefaults.researchDirectory;
  }

  getResearchDirectory(agent: Agent): string {
    return agent.getState(ResearchState).researchDirectory;
  }

  getCurrentItem(agent: Agent): Item | undefined {
    return agent.getState(ResearchState).currentItem;
  }

  async selectItem(topicName: string, itemName: string, agent: Agent): Promise<Item | null> {
    const directory = this.getResearchDirectory(agent);
    const item = await this.getItem(directory, topicName, itemName);
    agent.mutateState(ResearchState, state => {
      state.currentItem = item ?? undefined;
    });
    return item;
  }

  clearCurrentItem(agent: Agent): void {
    agent.mutateState(ResearchState, state => {
      state.currentItem = undefined;
    });
  }

  private resolveTopicDirectory(root: string, topicName: string): string {
    assertValidName(topicName, "topic");
    return path.join(root, topicName);
  }

  private resolveItemPath(root: string, topicName: string, itemName: string): string {
    assertValidName(itemName, "item");
    return path.join(this.resolveTopicDirectory(root, topicName), `${itemName}${EXTENSION}`);
  }

  async listTopics(root: string): Promise<TopicSummary[]> {
    let entries: Dirent[];
    try {
      entries = await fs.readdir(root, { withFileTypes: true });
    } catch {
      return [];
    }

    const topics: TopicSummary[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
      const topicDir = path.join(root, entry.name);
      const stat = await fs.stat(topicDir);
      const itemCount = await this.countItems(topicDir);
      topics.push({ name: entry.name, itemCount, updatedAt: stat.mtime.toISOString() });
    }

    return topics.sort((a, b) => a.name.localeCompare(b.name));
  }

  private async countItems(topicDir: string): Promise<number> {
    try {
      const files = await fs.readdir(topicDir);
      return files.filter(f => f.endsWith(EXTENSION)).length;
    } catch {
      return 0;
    }
  }

  async createTopic(root: string, topicName: string): Promise<TopicSummary> {
    const topicDir = this.resolveTopicDirectory(root, topicName);
    if (await pathExists(topicDir)) {
      throw new Error(`Topic "${topicName}" already exists`);
    }
    await fs.mkdir(topicDir, { recursive: true });
    const stat = await fs.stat(topicDir);
    return { name: topicName, itemCount: 0, updatedAt: stat.mtime.toISOString() };
  }

  async deleteTopic(root: string, topicName: string): Promise<boolean> {
    const topicDir = this.resolveTopicDirectory(root, topicName);
    try {
      await fs.rm(topicDir, { recursive: true });
      return true;
    } catch {
      return false;
    }
  }

  async listItems(root: string, topicName: string): Promise<ItemSummary[]> {
    const topicDir = this.resolveTopicDirectory(root, topicName);
    let entries: string[];
    try {
      entries = await fs.readdir(topicDir);
    } catch {
      return [];
    }

    const items: ItemSummary[] = [];
    for (const entry of entries) {
      if (!entry.endsWith(EXTENSION)) continue;
      const stat = await fs.stat(path.join(topicDir, entry));
      if (!stat.isFile()) continue;
      items.push({ topicName, name: entry.slice(0, -EXTENSION.length), size: stat.size, updatedAt: stat.mtime.toISOString() });
    }

    return items.sort((a, b) => a.name.localeCompare(b.name));
  }

  async getItem(root: string, topicName: string, itemName: string): Promise<Item | null> {
    const filePath = this.resolveItemPath(root, topicName, itemName);
    let stat: Awaited<ReturnType<typeof fs.stat>>;
    try {
      stat = await fs.stat(filePath);
    } catch {
      return null;
    }
    const content = await fs.readFile(filePath, "utf-8");
    return { topicName, name: itemName, content, size: stat.size, updatedAt: stat.mtime.toISOString() };
  }

  async createItem(root: string, topicName: string, itemName: string, content: string): Promise<Item> {
    const filePath = this.resolveItemPath(root, topicName, itemName);
    if (await pathExists(filePath)) {
      throw new Error(`Item "${itemName}" already exists in topic "${topicName}"`);
    }
    return this.writeItemFile(root, topicName, itemName, content);
  }

  /**
   * Overwrite an item, creating it unless `requireExisting` is set. Editors pass
   * `requireExisting` so saving an item deleted elsewhere fails instead of
   * silently re-creating it; agents writing findings keep the upsert.
   */
  async updateItem(root: string, topicName: string, itemName: string, content: string, options: { requireExisting?: boolean } = {}): Promise<Item> {
    if (options.requireExisting && !(await pathExists(this.resolveItemPath(root, topicName, itemName)))) {
      throw new Error(`Item "${itemName}" no longer exists in topic "${topicName}" — it was deleted elsewhere. Use Save As to keep your copy.`);
    }
    return this.writeItemFile(root, topicName, itemName, content);
  }

  async deleteItem(root: string, topicName: string, itemName: string): Promise<boolean> {
    const filePath = this.resolveItemPath(root, topicName, itemName);
    try {
      await fs.unlink(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Moves (renames) a dossier, possibly into another topic, which is created
   * when missing. Refuses to overwrite an existing dossier.
   */
  async renameItem(root: string, fromTopic: string, fromName: string, toTopic: string, toName: string): Promise<Item> {
    const fromPath = this.resolveItemPath(root, fromTopic, fromName);
    const toPath = this.resolveItemPath(root, toTopic, toName);
    if (fromPath === toPath) {
      const item = await this.getItem(root, fromTopic, fromName);
      if (!item) throw new Error(`Item "${fromName}" not found in topic "${fromTopic}"`);
      return item;
    }
    if (!(await pathExists(fromPath))) {
      throw new Error(`Item "${fromName}" not found in topic "${fromTopic}"`);
    }
    if (await pathExists(toPath)) {
      throw new Error(`Item "${toName}" already exists in topic "${toTopic}"`);
    }
    await fs.mkdir(path.dirname(toPath), { recursive: true });
    await fs.rename(fromPath, toPath);
    const item = await this.getItem(root, toTopic, toName);
    if (!item) throw new Error(`Item "${toName}" could not be read after moving it`);
    return item;
  }

  /**
   * Case-insensitive search across every topic: matches dossier names, their
   * title heading and their content. Title matches rank first, then by the
   * number of content matches, then most recently updated.
   */
  async searchItems(root: string, query: string, options: { topicName?: string; limit?: number } = {}): Promise<ItemSearchResult[]> {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    const topics = options.topicName ? [options.topicName] : (await this.listTopics(root)).map(topic => topic.name);

    const results: ItemSearchResult[] = [];
    for (const topicName of topics) {
      for (const summary of await this.listItems(root, topicName)) {
        let content: string;
        try {
          content = await fs.readFile(this.resolveItemPath(root, topicName, summary.name), "utf-8");
        } catch {
          continue;
        }
        const title = extractTitle(content);
        const titleMatch = summary.name.toLowerCase().includes(needle) || (title?.toLowerCase().includes(needle) ?? false);
        const lower = content.toLowerCase();
        const contentMatches = countOccurrences(lower, needle);
        if (!titleMatch && contentMatches === 0) continue;
        const firstIndex = lower.indexOf(needle);
        results.push({
          topicName,
          name: summary.name,
          title,
          titleMatch,
          contentMatches,
          snippet: firstIndex === -1 ? makeSnippet(content, 0, 0) : makeSnippet(content, firstIndex, needle.length),
          updatedAt: summary.updatedAt,
        });
      }
    }

    results.sort((a, b) => Number(b.titleMatch) - Number(a.titleMatch) || b.contentMatches - a.contentMatches || b.updatedAt.localeCompare(a.updatedAt));
    return results.slice(0, options.limit ?? 50);
  }

  /**
   * Every dossier in a topic concatenated into one Markdown document, each
   * under a `## <name>` section separated by rules.
   */
  async exportTopic(root: string, topicName: string): Promise<{ fileName: string; content: string; itemCount: number }> {
    const topicDir = this.resolveTopicDirectory(root, topicName);
    if (!(await pathExists(topicDir))) throw new Error(`Topic "${topicName}" not found`);
    const sections: string[] = [];
    for (const summary of await this.listItems(root, topicName)) {
      const item = await this.getItem(root, topicName, summary.name);
      if (!item) continue;
      sections.push(`## ${item.name}\n\n${item.content.trim()}\n`);
    }
    const header = `# ${topicName}\n\n_Exported ${new Date().toISOString()} · ${sections.length} ${sections.length === 1 ? "dossier" : "dossiers"}_\n`;
    return { fileName: `${topicName}.md`, content: [header, ...sections].join("\n---\n\n"), itemCount: sections.length };
  }

  private async writeItemFile(root: string, topicName: string, itemName: string, content: string): Promise<Item> {
    const filePath = this.resolveItemPath(root, topicName, itemName);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content, "utf-8");
    const stat = await fs.stat(filePath);
    return { topicName, name: itemName, content, size: stat.size, updatedAt: stat.mtime.toISOString() };
  }
}

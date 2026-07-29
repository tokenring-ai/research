import type { Dirent } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import type Agent from "@tokenring-ai/agent/Agent";
import type { AgentCreationContext } from "@tokenring-ai/agent/types";
import type { TokenRingService } from "@tokenring-ai/app/types";
import deepClone from "@tokenring-ai/utility/object/deepClone";
import { type Item, type ItemSummary, type ParsedResearchConfig, ResearchAgentConfigSchema, ResearchServiceConfigSchema, type TopicSummary } from "./schema.ts";
import { ResearchState } from "./state/ResearchState.ts";

const NAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/;
const EXTENSION = ".md";

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

  async updateItem(root: string, topicName: string, itemName: string, content: string): Promise<Item> {
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

  private async writeItemFile(root: string, topicName: string, itemName: string, content: string): Promise<Item> {
    const filePath = this.resolveItemPath(root, topicName, itemName);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content, "utf-8");
    const stat = await fs.stat(filePath);
    return { topicName, name: itemName, content, size: stat.size, updatedAt: stat.mtime.toISOString() };
  }
}

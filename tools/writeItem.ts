import type Agent from "@tokenring-ai/agent/Agent";
import type { TokenRingToolDefinition, TokenRingToolResult } from "@tokenring-ai/chat/schema";
import { z } from "zod";
import ResearchService from "../ResearchService.ts";

const name = "item_write";
const displayName = "Research/write item";

async function execute({ topicName, name: itemName, content }: z.output<typeof inputSchema>, agent: Agent): Promise<TokenRingToolResult> {
  const researchService = agent.requireServiceByType(ResearchService);
  const directory = researchService.getResearchDirectory(agent);
  const item = await researchService.updateItem(directory, topicName, itemName, content);

  return {
    message: `**Research** Saved "${topicName}/${itemName}"`,
    result: JSON.stringify({ topicName: item.topicName, name: item.name, size: item.size, updatedAt: item.updatedAt }),
  };
}

const description =
  "Create or overwrite a research item (a single markdown file) within a topic. The topic is created automatically if it doesn't already exist. Use this to save research notes, summaries, and deep-dives so they can be referenced later or viewed by the user.";

const inputSchema = z.object({
  topicName: z.string().describe("Name of the topic this item belongs to; created automatically if it doesn't exist"),
  name: z.string().describe("Name of the item to create or update"),
  content: z.string().describe("Full markdown content of the research item"),
});

export default {
  name,
  displayName,
  description,
  inputSchema,
  execute,
} satisfies TokenRingToolDefinition<typeof inputSchema>;

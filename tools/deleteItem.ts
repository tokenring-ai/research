import type Agent from "@tokenring-ai/agent/Agent";
import type { TokenRingToolDefinition, TokenRingToolResult } from "@tokenring-ai/chat/schema";
import { z } from "zod";
import ResearchService from "../ResearchService.ts";

const name = "item_delete";
const displayName = "Research/delete item";

async function execute({ topicName, name: itemName }: z.output<typeof inputSchema>, agent: Agent): Promise<TokenRingToolResult> {
  const researchService = agent.requireServiceByType(ResearchService);
  const directory = researchService.getResearchDirectory(agent);
  const success = await researchService.deleteItem(directory, topicName, itemName);

  return {
    message: success ? `**Research** Deleted "${topicName}/${itemName}"` : `**Research** Item "${itemName}" not found in topic "${topicName}"`,
    result: JSON.stringify({ success }),
  };
}

const description = "Delete a research item (a single markdown file) from a topic";

const inputSchema = z.object({
  topicName: z.string().describe("Name of the topic the item belongs to"),
  name: z.string().describe("Name of the item to delete"),
});

export default {
  name,
  displayName,
  description,
  inputSchema,
  execute,
} satisfies TokenRingToolDefinition<typeof inputSchema>;

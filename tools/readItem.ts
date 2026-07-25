import type Agent from "@tokenring-ai/agent/Agent";
import type { TokenRingToolDefinition, TokenRingToolResult } from "@tokenring-ai/chat/schema";
import { z } from "zod";
import ResearchService from "../ResearchService.ts";

const name = "item_read";
const displayName = "Research/read item";

async function execute({ topicName, name: itemName }: z.output<typeof inputSchema>, agent: Agent): Promise<TokenRingToolResult> {
  const researchService = agent.requireServiceByType(ResearchService);
  const directory = researchService.getResearchDirectory(agent);
  const item = await researchService.getItem(directory, topicName, itemName);

  if (!item) {
    return {
      message: `**Research** Item "${itemName}" not found in topic "${topicName}"`,
      result: JSON.stringify({ error: `Item "${itemName}" not found in topic "${topicName}"` }),
    };
  }

  return {
    message: `**Research** Read "${topicName}/${itemName}"`,
    result: JSON.stringify(item),
  };
}

const description = "Read the markdown content of a research item within a topic";

const inputSchema = z.object({
  topicName: z.string().describe("Name of the topic the item belongs to"),
  name: z.string().describe("Name of the item to read"),
});

export default {
  name,
  displayName,
  description,
  inputSchema,
  execute,
} satisfies TokenRingToolDefinition<typeof inputSchema>;

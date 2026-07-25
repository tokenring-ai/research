import type Agent from "@tokenring-ai/agent/Agent";
import type { TokenRingToolDefinition, TokenRingToolResult } from "@tokenring-ai/chat/schema";
import { z } from "zod";
import ResearchService from "../ResearchService.ts";

const name = "item_list";
const displayName = "Research/list items";

async function execute({ topicName }: z.output<typeof inputSchema>, agent: Agent): Promise<TokenRingToolResult> {
  const researchService = agent.requireServiceByType(ResearchService);
  const directory = researchService.getResearchDirectory(agent);
  const items = await researchService.listItems(directory, topicName);

  return {
    message: `**Research** Listed ${items.length} item${items.length === 1 ? "" : "s"} in topic "${topicName}"`,
    result: JSON.stringify({ items }),
  };
}

const description = "List the named markdown research items within a topic";

const inputSchema = z.object({
  topicName: z.string().describe("Name of the topic to list items from"),
});

export default {
  name,
  displayName,
  description,
  inputSchema,
  execute,
} satisfies TokenRingToolDefinition<typeof inputSchema>;

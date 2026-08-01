import type Agent from "@tokenring-ai/agent/Agent";
import type { TokenRingToolDefinition, TokenRingToolResult } from "@tokenring-ai/chat/schema";
import { z } from "zod";
import ResearchService from "../ResearchService.ts";

const name = "topic_create";
const displayName = "Research/create topic";

async function execute({ name: topicName }: z.output<typeof inputSchema>, agent: Agent): Promise<TokenRingToolResult> {
  const researchService = agent.requireService(ResearchService);
  const directory = researchService.getResearchDirectory(agent);
  const topic = await researchService.createTopic(directory, topicName);

  return {
    message: `**Research** Created topic "${topicName}"`,
    result: JSON.stringify(topic),
  };
}

const description = "Create a new, empty research topic (a named collection of related markdown items)";

const inputSchema = z.object({
  name: z.string().describe("Name of the topic to create"),
});

export default {
  name,
  displayName,
  description,
  inputSchema,
  execute,
} satisfies TokenRingToolDefinition<typeof inputSchema>;

import type Agent from "@tokenring-ai/agent/Agent";
import type { TokenRingToolDefinition, TokenRingToolResult } from "@tokenring-ai/chat/schema";
import { z } from "zod";
import ResearchService from "../ResearchService.ts";

const name = "topic_list";
const displayName = "Research/list topics";

async function execute(_input: z.output<typeof inputSchema>, agent: Agent): Promise<TokenRingToolResult> {
  const researchService = agent.requireServiceByType(ResearchService);
  const directory = researchService.getResearchDirectory(agent);
  const topics = await researchService.listTopics(directory);

  return {
    message: `**Research** Listed ${topics.length} topic${topics.length === 1 ? "" : "s"}`,
    result: JSON.stringify({ topics }),
  };
}

const description = "List the research topics (collections of related markdown items) in the research directory";

const inputSchema = z.object({});

export default {
  name,
  displayName,
  description,
  inputSchema,
  execute,
} satisfies TokenRingToolDefinition<typeof inputSchema>;

import type { Agent } from "@tokenring-ai/agent";
import type { TokenRingToolDefinition, TokenRingToolResult } from "@tokenring-ai/chat/schema";
import { z } from "zod";
import ResearchService from "../ResearchService.js";

const name = "research_run";
const displayName = "Research/deep research";

/**
 * Starts a deep research agent for the given topic/prompt (non-blocking).
 */
async function execute({ topic, prompt }: z.output<typeof inputSchema>, agent: Agent): Promise<TokenRingToolResult> {
  const researchService = agent.requireServiceByType(ResearchService);
  const query = prompt.trim() ? `${topic.trim()}: ${prompt.trim()}` : topic.trim();
  const { agentId, researchDirectory } = researchService.startResearch(query, { headless: agent.headless });

  return {
    message: `**Research** Conducted research on ${topic}`,
    result: JSON.stringify({
      status: "started",
      topic,
      agentId,
      researchDirectory,
      message: `Deep research agent ${agentId} started. Output will be written under ${researchDirectory}.`,
    }),
  };
}

const description =
  "Starts a deep multi-file research agent on a topic. Returns the agent id and research directory; the agent writes SUMMARY.md, TOC.md, and topic files asynchronously.";

const inputSchema = z.object({
  topic: z.string().describe("The main topic or subject to research"),
  prompt: z.string().describe("The detailed research prompt or specific questions to investigate about the topic"),
});

export default {
  name,
  displayName,
  description,
  inputSchema,
  execute,
} satisfies TokenRingToolDefinition<typeof inputSchema>;

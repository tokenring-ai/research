import {Agent} from "@tokenring-ai/agent";
import {TokenRingToolDefinition} from "@tokenring-ai/chat/schema";
import {z} from "zod";
import ResearchService from "../ResearchService.js";
export interface ResearchSuccessResult {
  status: "completed";
  topic: string;
  research: string;
  message: string;
}

export interface ResearchErrorResult {
  status: "error";
  topic: string;
  error: string;
  message: string;
}

export type ResearchResult = ResearchSuccessResult | ResearchErrorResult;

const name = "research_run";

/**
 * Dispatches a research request to an AI Research Agent and returns the generated research
 * @param args
 * @param agent
 * @returns Result containing the generated research
 */
async function execute(
  {topic, prompt}: z.infer<typeof inputSchema>,
  agent: Agent,
): Promise<ResearchResult> {
  const researchService = agent.requireServiceByType(ResearchService);

  if (!topic) {
    throw new Error(`[${name}] Error: Topic is required`);
  }

  if (!prompt) {
    throw new Error(`[${name}] Error: Prompt is required`);
  }

  const research = await researchService.runResearch(topic, prompt, agent);

  return {
    status: "completed",
    topic,
    research,
    message: `Research completed successfully for topic: ${topic}`,
  };

}

const description =
  "Dispatches a research request to an AI agent, and returns the generated research content.";

const inputSchema = z.object({
  topic: z.string().describe("The main topic or subject to research"),
  prompt: z
    .string()
    .describe(
      "The detailed research prompt or specific questions to investigate about the topic",
    ),
});

export default {
  name, description, inputSchema, execute,
} satisfies TokenRingToolDefinition<typeof inputSchema>;
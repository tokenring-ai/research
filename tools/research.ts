import {Agent} from "@tokenring-ai/agent";
import {z} from "zod";
import ResearchService from "../ResearchService.js";

export interface ResearchArgs {
  topic?: string;
  prompt?: string;
}

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

export const name = "research/run";

/**
 * Dispatches a research request to an AI Research Agent and returns the generated research
 * @param args
 * @param agent
 * @returns Result containing the generated research
 */
export async function execute(
  {topic, prompt}: ResearchArgs,
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

export const description =
  "Dispatches a research request to an AI agent, and returns the generated research content.";

export const inputSchema = z.object({
  topic: z.string().describe("The main topic or subject to research"),
  prompt: z
    .string()
    .describe(
      "The detailed research prompt or specific questions to investigate about the topic",
    ),
});

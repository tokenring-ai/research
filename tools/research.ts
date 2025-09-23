import {Agent} from "@tokenring-ai/agent";
import {ModelRegistry} from "@tokenring-ai/ai-client";
import {outputChatAnalytics} from "@tokenring-ai/ai-client/util/outputChatAnalytics";
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
  const modelRegistry = agent.requireServiceByType(ModelRegistry);
  const researchService = agent.requireServiceByType(ResearchService);

  if (!topic) {
    throw new Error(`[${name}] Error: Topic is required`);
  }

  if (!prompt) {
    throw new Error(`[${name}] Error: Prompt is required`);
  }

  // Get Gemini client from model registry
  const aiChatClient = await modelRegistry.chat.getFirstOnlineClient(researchService.researchModel);


  agent.systemMessage(`[Research] Dispatching research request for "${topic}" to ${aiChatClient.getModelId()}`);

  // Generate research using Gemini
  const [research, response] = await aiChatClient.textChat(
    {
      tools: {},
      messages: [
        {
          role: "system",
          content:
            "You are a research assistant, tasked with researching a topic for the user, using web search. " +
            "The users is going to ask you a question, and you will research that using the wbe search tool, and return detailed and comprehensive research on the topic.",
        },
        {
          role: "user",
          content: `Research the following topic: ${topic}, focusing on the following question: ${prompt}`,
        },
      ],
    },
    agent,
  );

  agent.systemMessage(`[${name}] Successfully generated research for "${topic}"`);
  agent.chatOutput(`Research: \n${research}"`);

  outputChatAnalytics(response, agent, name);

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

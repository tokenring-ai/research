import {Agent} from "@tokenring-ai/agent";
import {ChatModelRegistry} from "@tokenring-ai/ai-client/ModelRegistry";
import {TokenRingService} from "@tokenring-ai/app/types";
import {outputChatAnalytics} from "@tokenring-ai/chat/util/outputChatAnalytics";
import {z} from "zod";

export const ResearchServiceConfigSchema = z.object({
  researchModel: z.string(),
});

const name = "research_run";

export type ResearchServiceConfig = z.infer<typeof ResearchServiceConfigSchema>;

/**
 * The actual implementation of GhostIOService
 */
export default class ResearchService implements TokenRingService {
  readonly name = "ResearchService";
  description = "Provides Research functionality";

  constructor(private options: ResearchServiceConfig) {
  }

  async runResearch(topic: string, prompt: string, agent: Agent): Promise<string> {
    const chatModelRegistry = agent.requireServiceByType(ChatModelRegistry);

    // Get Gemini client from model registry
    const aiChatClient = await chatModelRegistry.getClient(this.options.researchModel);


    agent.infoMessage(`[Research] Dispatching research request for "${topic}" to ${aiChatClient.getModelId()}`);

    // Generate research using Gemini
    const [research, response] = await aiChatClient.textChat(
      {
        tools: {},
        messages: [
          {
            role: "system",
            content:
              "You are a highly precise research assistant. Your sole objective is to provide factual, verified information from established, reliable news organizations and academic sources.\n\n" +
              "STRICT ADHERENCE TO THE FOLLOWING IS REQUIRED:\n" +
              "1. VERBATIM EXTRACTION: When reporting facts, extract the relevant text verbatim from the source. Do not paraphrase key data points.\n" +
              "2. SOURCE CITATION: Every claim must be accompanied by a specific URL or named reputable source. If you cannot cite it, you cannot include it.\n" +
              "3. ZERO TOLERANCE FOR HALLUCINATION: If multiple reliable sources do not explicitly confirm the user's premise, you must state: 'The information could not be found and the premise of the request may be incorrect.' Never attempt to 'fill in the gaps' with plausible-sounding information.\n" +
              "4. CONFLICTING DATA: If reputable sources provide conflicting information, report both perspectives verbatim and note the discrepancy.\n" +
              "5. NO SPECULATION: Do not offer opinions, future predictions, or creative interpretations. Return only what is explicitly documented in the search results.",
          },
          {
            role: "user",
            content: `Research the following topic: ${topic}, focusing on the following question: ${prompt}`,
          },
        ],
      },
      agent,
    );

    agent.infoMessage(`[${name}] Successfully generated research for "${topic}"`);
    agent.artifactOutput({
      name: `Research on ${topic}`,
      encoding: 'text',
      mimeType: 'text/markdown',
      body: `Topic: ${topic}\nPrompt: ${prompt}\n\nResult: ${research}`
    });

    outputChatAnalytics(response, agent, name);

    return research;
  }
}
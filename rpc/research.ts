import { AgentManager } from "@tokenring-ai/agent";
import type TokenRingApp from "@tokenring-ai/app";
import { createPollingQueryStream } from "@tokenring-ai/rpc/createPollingQueryStream";
import { createRPCEndpoint } from "@tokenring-ai/rpc/createRPCEndpoint";
import ResearchService from "../ResearchService.ts";
import { ResearchState } from "../state/ResearchState.ts";
import ResearchRpcSchema from "./schema.ts";

/**
 * Whether any web-search provider is registered. The websearch plugin is
 * optional, so its service is looked up by name rather than imported.
 */
export function isSearchProviderAvailable(app: Pick<TokenRingApp, "services">): boolean {
  const webSearch = app.services.get("WebSearchService") as { getAvailableProviders?: () => string[] } | undefined;
  return (webSearch?.getAvailableProviders?.().length ?? 0) > 0;
}

async function projectTopics(_args: Record<string, never>, app: TokenRingApp) {
  const researchService = app.requireService(ResearchService);
  const topics = await researchService.listTopics(researchService.getDefaultResearchDirectory());
  return { topics };
}

async function projectItems(args: { topicName: string }, app: TokenRingApp) {
  const researchService = app.requireService(ResearchService);
  const items = await researchService.listItems(researchService.getDefaultResearchDirectory(), args.topicName);
  return { items };
}

const streamTopics = createPollingQueryStream({
  intervalMs: 3000,
  poll: projectTopics,
});

const streamItems = createPollingQueryStream({
  intervalMs: 3000,
  poll: projectItems,
});

export default createRPCEndpoint(ResearchRpcSchema, {
  getResearchConfiguration(_args, app: TokenRingApp) {
    const researchService = app.requireService(ResearchService);

    return {
      agentTypes: researchService.getAgentTypes(),
      searchProviderAvailable: isSearchProviderAvailable(app),
    };
  },

  async listTopics(args, app: TokenRingApp) {
    return projectTopics(args, app);
  },

  streamTopics,

  async createTopic(args, app: TokenRingApp) {
    const researchService = app.requireService(ResearchService);
    const topic = await researchService.createTopic(researchService.getDefaultResearchDirectory(), args.name);
    return { topic };
  },

  async setTopicTags(args, app: TokenRingApp) {
    const researchService = app.requireService(ResearchService);
    const topic = await researchService.setTopicTags(researchService.getDefaultResearchDirectory(), args.name, args.tags);
    return { topic };
  },

  async deleteTopic(args, app: TokenRingApp) {
    const researchService = app.requireService(ResearchService);
    const success = await researchService.deleteTopic(researchService.getDefaultResearchDirectory(), args.name);
    return { success };
  },

  async listItems(args, app: TokenRingApp) {
    return projectItems(args, app);
  },

  streamItems,

  async getItem(args, app: TokenRingApp) {
    const researchService = app.requireService(ResearchService);
    const item = await researchService.getItem(researchService.getDefaultResearchDirectory(), args.topicName, args.name);
    return { item };
  },

  async createItem(args, app: TokenRingApp) {
    const researchService = app.requireService(ResearchService);
    const item = await researchService.createItem(researchService.getDefaultResearchDirectory(), args.topicName, args.name, args.content, args.sources);
    return { item };
  },

  async updateItem(args, app: TokenRingApp) {
    const researchService = app.requireService(ResearchService);
    // The editor saves an item it loaded; one deleted meanwhile is a conflict, not a silent re-create.
    const item = await researchService.updateItem(researchService.getDefaultResearchDirectory(), args.topicName, args.name, args.content, {
      requireExisting: true,
      ...(args.sources ? { sources: args.sources } : {}),
      ...(args.baseSources ? { expectedSources: args.baseSources } : {}),
    });
    return { item };
  },

  async deleteItem(args, app: TokenRingApp) {
    const researchService = app.requireService(ResearchService);
    const success = await researchService.deleteItem(researchService.getDefaultResearchDirectory(), args.topicName, args.name);
    return { success };
  },

  async renameItem(args, app: TokenRingApp) {
    const researchService = app.requireService(ResearchService);
    const item = await researchService.renameItem(researchService.getDefaultResearchDirectory(), args.topicName, args.name, args.newTopicName, args.newName);
    // Agents that had the old dossier selected follow it to its new name.
    const root = researchService.getDefaultResearchDirectory();
    for (const agent of app.requireService(AgentManager).getAgents()) {
      let state: ResearchState;
      try {
        state = agent.getState(ResearchState);
      } catch {
        continue; // Agent without the research slice.
      }
      const current = state.currentItem;
      if (state.researchDirectory === root && current?.topicName === args.topicName && current.name === args.name) {
        agent.mutateState(ResearchState, state => {
          state.currentItem = item;
        });
      }
    }
    return { item };
  },

  async searchItems(args, app: TokenRingApp) {
    const researchService = app.requireService(ResearchService);
    const results = await researchService.searchItems(researchService.getDefaultResearchDirectory(), args.query, {
      ...(args.topicName ? { topicName: args.topicName } : {}),
      ...(args.limit ? { limit: args.limit } : {}),
    });
    return { results };
  },

  async exportTopic(args, app: TokenRingApp) {
    const researchService = app.requireService(ResearchService);
    return researchService.exportTopic(researchService.getDefaultResearchDirectory(), args.topicName);
  },

  async exportBrief(args, app: TokenRingApp) {
    const researchService = app.requireService(ResearchService);
    const root = researchService.getDefaultResearchDirectory();
    if (args.format === "docx" || args.format === "pdf") return researchService.exportBriefFile(root, args.topicName, args.format);
    return researchService.exportBrief(root, args.topicName);
  },

  getResearchState(args, app: TokenRingApp) {
    const agent = app.requireService(AgentManager).getAgent(args.agentId);
    if (!agent) {
      return { status: "agentNotFound" };
    }

    const state = agent.getState(ResearchState);
    return {
      status: "success",
      selectedTopicName: state.currentItem?.topicName ?? null,
      selectedItemName: state.currentItem?.name ?? null,
    };
  },

  async updateResearchState(args, app: TokenRingApp) {
    const agent = app.requireService(AgentManager).getAgent(args.agentId);
    if (!agent) {
      return { status: "agentNotFound" };
    }

    const researchService = app.requireService(ResearchService);

    if (args.selectedTopicName && args.selectedItemName) {
      await researchService.selectItem(args.selectedTopicName, args.selectedItemName, agent);
    }

    const state = agent.getState(ResearchState);
    return {
      status: "success",
      selectedTopicName: state.currentItem?.topicName ?? null,
      selectedItemName: state.currentItem?.name ?? null,
    };
  },
});

import { AgentManager } from "@tokenring-ai/agent";
import type TokenRingApp from "@tokenring-ai/app";
import { createPollingQueryStream } from "@tokenring-ai/rpc/createPollingQueryStream";
import { createRPCEndpoint } from "@tokenring-ai/rpc/createRPCEndpoint";
import ResearchService from "../ResearchService.ts";
import { ResearchState } from "../state/ResearchState.ts";
import ResearchRpcSchema from "./schema.ts";

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
  async listTopics(args, app: TokenRingApp) {
    return projectTopics(args, app);
  },

  streamTopics,

  async createTopic(args, app: TokenRingApp) {
    const researchService = app.requireService(ResearchService);
    const topic = await researchService.createTopic(researchService.getDefaultResearchDirectory(), args.name);
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
    const item = await researchService.createItem(researchService.getDefaultResearchDirectory(), args.topicName, args.name, args.content);
    return { item };
  },

  async updateItem(args, app: TokenRingApp) {
    const researchService = app.requireService(ResearchService);
    const item = await researchService.updateItem(researchService.getDefaultResearchDirectory(), args.topicName, args.name, args.content);
    return { item };
  },

  async deleteItem(args, app: TokenRingApp) {
    const researchService = app.requireService(ResearchService);
    const success = await researchService.deleteItem(researchService.getDefaultResearchDirectory(), args.topicName, args.name);
    return { success };
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

import type { RPCSchema } from "@tokenring-ai/rpc/types";
import { AgentNotFoundSchema, SuccessSchema } from "@tokenring-ai/rpc/types";
import { z } from "zod";
import { ItemSchema, ItemSummarySchema, TopicSummarySchema } from "../schema.ts";

export default {
  name: "Research RPC",
  path: "/rpc/research",
  methods: {
    listTopics: {
      type: "query",
      input: z.object({}),
      result: z.object({
        topics: z.array(TopicSummarySchema),
      }),
    },
    streamTopics: {
      type: "stream",
      input: z.object({}),
      result: z.object({
        topics: z.array(TopicSummarySchema),
      }),
    },
    createTopic: {
      type: "mutation",
      input: z.object({
        name: z.string(),
      }),
      result: z.object({
        topic: TopicSummarySchema,
      }),
    },
    deleteTopic: {
      type: "mutation",
      input: z.object({
        name: z.string(),
      }),
      result: z.object({
        success: z.boolean(),
      }),
    },
    listItems: {
      type: "query",
      input: z.object({
        topicName: z.string(),
      }),
      result: z.object({
        items: z.array(ItemSummarySchema),
      }),
    },
    streamItems: {
      type: "stream",
      input: z.object({
        topicName: z.string(),
      }),
      result: z.object({
        items: z.array(ItemSummarySchema),
      }),
    },
    getItem: {
      type: "query",
      input: z.object({
        topicName: z.string(),
        name: z.string(),
      }),
      result: z.object({
        item: ItemSchema.nullable(),
      }),
    },
    createItem: {
      type: "mutation",
      input: z.object({
        topicName: z.string(),
        name: z.string(),
        content: z.string().default(""),
      }),
      result: z.object({
        item: ItemSchema,
      }),
    },
    updateItem: {
      type: "mutation",
      input: z.object({
        topicName: z.string(),
        name: z.string(),
        content: z.string(),
      }),
      result: z.object({
        item: ItemSchema,
      }),
    },
    deleteItem: {
      type: "mutation",
      input: z.object({
        topicName: z.string(),
        name: z.string(),
      }),
      result: z.object({
        success: z.boolean(),
      }),
    },
    getResearchState: {
      type: "query",
      input: z.object({
        agentId: z.string(),
      }),
      result: z.discriminatedUnion("status", [
        SuccessSchema.extend({
          selectedTopicName: z.string().nullable(),
          selectedItemName: z.string().nullable(),
        }),
        AgentNotFoundSchema,
      ]),
    },
    updateResearchState: {
      type: "mutation",
      input: z.object({
        agentId: z.string(),
        selectedTopicName: z.string().exactOptional(),
        selectedItemName: z.string().exactOptional(),
      }),
      result: z.discriminatedUnion("status", [
        SuccessSchema.extend({
          selectedTopicName: z.string().nullable(),
          selectedItemName: z.string().nullable(),
        }),
        AgentNotFoundSchema,
      ]),
    },
  },
} satisfies RPCSchema;

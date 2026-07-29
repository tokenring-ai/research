import type { Agent } from "@tokenring-ai/agent";
import { AgentStateSlice } from "@tokenring-ai/agent/types";
import deepClone from "@tokenring-ai/utility/object/deepClone";
import { z } from "zod";
import { type Item, ItemSchema, type ParsedResearchConfig } from "../schema.ts";

const serializationSchema = z.object({
  researchDirectory: z.string(),
  currentItem: ItemSchema.optional(),
  lastAttachedItemId: z.string().optional(),
});

export class ResearchState extends AgentStateSlice<typeof serializationSchema> {
  researchDirectory: string;
  currentItem: Item | undefined;
  lastAttachedItemId: string | undefined;

  constructor(readonly initialConfig: ParsedResearchConfig["agentDefaults"]) {
    super("ResearchState", serializationSchema);
    this.researchDirectory = initialConfig.researchDirectory;
  }

  transferStateFromParent(parent: Agent): void {
    const parentState = parent.getState(ResearchState);
    this.currentItem ??= deepClone(parentState.currentItem);
  }

  serialize(): z.output<typeof serializationSchema> {
    return {
      researchDirectory: this.researchDirectory,
      currentItem: this.currentItem,
      lastAttachedItemId: this.lastAttachedItemId,
    };
  }

  deserialize(data: z.output<typeof serializationSchema>): void {
    this.researchDirectory = data.researchDirectory;
    this.currentItem = data.currentItem;
    this.lastAttachedItemId = data.lastAttachedItemId;
  }

  show(): string {
    const current = this.currentItem ? `${this.currentItem.topicName}/${this.currentItem.name}` : "None";
    return `Research Directory: ${this.researchDirectory}
    Current Item: ${current}
    Last Attached Item ID: ${this.lastAttachedItemId ?? "None"}`;
  }
}

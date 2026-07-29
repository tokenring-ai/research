import { AfterInputReceived } from "@tokenring-ai/agent";
import type Agent from "@tokenring-ai/agent/Agent";
import type { HookSubscription } from "@tokenring-ai/lifecycle/types";
import { HookCallback } from "@tokenring-ai/lifecycle/util/hooks";
import { ResearchState } from "../state/ResearchState.ts";

const name = "addSelectedItem";
const displayName = "Research/Add currently selected item to chat";
const description = "Attaches the currently selected research markdown item to the chat message";

function itemAttachmentId(topicName: string, itemName: string): string {
  return `${topicName}/${itemName}`;
}

async function addSelectedItem(data: AfterInputReceived, agent: Agent) {
  const attachments = (data.input.attachments ??= []);
  agent.mutateState(ResearchState, state => {
    if (!state.currentItem) return;

    const itemId = itemAttachmentId(state.currentItem.topicName, state.currentItem.name);
    if (state.lastAttachedItemId === itemId) return;

    state.lastAttachedItemId = itemId;
    attachments.push({
      name: `${state.currentItem.topicName}/${state.currentItem.name}.md`,
      description: "The markdown below is the currently selected research item.",
      encoding: "text",
      mimeType: "text/markdown",
      body: state.currentItem.content,
    });
  });
}

const callbacks = [new HookCallback(AfterInputReceived, addSelectedItem)];

export default {
  name,
  displayName,
  description,
  callbacks,
} satisfies HookSubscription;

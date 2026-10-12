import { BeforeInputReceived } from "@tokenring-ai/agent";
import type Agent from "@tokenring-ai/agent/Agent";
import type { HookSubscription } from "@tokenring-ai/lifecycle/types";
import { HookCallback } from "@tokenring-ai/lifecycle/util/hooks";
import ResearchService from "../ResearchService.ts";
import { ResearchState } from "../state/ResearchState.ts";

const name = "addSelectedItem";
const displayName = "Research/Add currently selected item to chat";
const description = "Attaches the currently selected research markdown item to the chat message";

function itemAttachmentId(topicName: string, itemName: string): string {
  return `${topicName}/${itemName}`;
}

/** Identifies one version of an item, so an edited dossier is attached again. */
function itemVersionId(topicName: string, itemName: string, updatedAt: string): string {
  return `${itemAttachmentId(topicName, itemName)}@${updatedAt}`;
}

async function addSelectedItem(data: BeforeInputReceived, agent: Agent) {
  const selected = agent.getState(ResearchState).currentItem;
  if (!selected) return;

  // The selection is a snapshot; re-read it so edits made since reach the agent.
  const researchService = agent.requireService(ResearchService);
  const item = await researchService.getItem(researchService.getResearchDirectory(agent), selected.topicName, selected.name);
  if (!item) return;

  const attachments = (data.input.attachments ??= []);
  agent.mutateState(ResearchState, state => {
    const versionId = itemVersionId(item.topicName, item.name, item.updatedAt);
    if (state.lastAttachedItemId === versionId) return;

    const previouslyAttached = state.lastAttachedItemId?.startsWith(`${itemAttachmentId(item.topicName, item.name)}@`) ?? false;
    state.currentItem = item;
    state.lastAttachedItemId = versionId;
    attachments.push({
      name: `${item.topicName}/${item.name}.md`,
      description: previouslyAttached
        ? "The markdown below is the updated version of the currently selected research item; it replaces the earlier copy."
        : "The markdown below is the currently selected research item.",
      encoding: "text",
      mimeType: "text/markdown",
      body: item.content,
    });
  });
}

const callbacks = [new HookCallback(BeforeInputReceived, addSelectedItem)];

export default {
  name,
  displayName,
  description,
  callbacks,
} satisfies HookSubscription;

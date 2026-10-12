import { useSyncExternalStore } from "react";

/**
 * State the Research views share outside React. Each dock panel is its own
 * subtree, so unsaved dossier edits and the agent the navigator is attached to
 * live here rather than in component state. In memory only.
 */

// ─── Unsaved dossier drafts ────────────────────────────────────────────────────

/** Edits not yet written to disk, keyed by `topic/item`, so closing a tab does not lose them. */
const drafts = new Map<string, string>();
const draftListeners = new Set<() => void>();

function notifyDrafts(): void {
  for (const listener of draftListeners) listener();
}

export function getItemDraft(key: string): string | null {
  return drafts.get(key) ?? null;
}

export function setItemDraft(key: string, content: string | null): void {
  if (content === null) {
    if (!drafts.delete(key)) return;
  } else {
    if (drafts.get(key) === content) return;
    drafts.set(key, content);
  }
  notifyDrafts();
}

export function useItemDraft(key: string | null): string | null {
  return useSyncExternalStore(
    listener => {
      draftListeners.add(listener);
      return () => {
        draftListeners.delete(listener);
      };
    },
    () => (key ? (drafts.get(key) ?? null) : null),
    () => null,
  );
}

/** Carries a dossier's unsaved draft over to its new key after a rename / move. */
export function moveItemDraft(fromKey: string, toKey: string): void {
  if (fromKey === toKey) return;
  const draft = drafts.get(fromKey);
  if (draft === undefined) return;
  drafts.delete(fromKey);
  drafts.set(toKey, draft);
  notifyDrafts();
}

/** Drops the drafts of every dossier in a deleted topic (keys are `topic/name`; names never contain "/"). */
export function clearItemDraftsInTopic(topicName: string): void {
  const prefix = `${topicName}/`;
  let changed = false;
  for (const key of drafts.keys()) {
    if (key.startsWith(prefix)) changed = drafts.delete(key) || changed;
  }
  if (changed) notifyDrafts();
}

/** Test helper. */
export function clearItemDrafts(): void {
  if (drafts.size === 0) return;
  drafts.clear();
  notifyDrafts();
}

// ─── The research agent the navigator is attached to ───────────────────────────

export interface ResearchAgentSession {
  agentId: string | null;
  /** Sends a `/deep research <query>` prompt, creating an agent when none is attached. */
  start: (query: string) => Promise<boolean>;
}

/**
 * Published by the topics navigator (the single owner of `useAppAgentSession`)
 * so the landing panel can start a research agent without owning a second,
 * competing session.
 */
let session: ResearchAgentSession | null = null;
const sessionListeners = new Set<() => void>();

export function setResearchAgentSession(next: ResearchAgentSession | null): void {
  session = next;
  for (const listener of sessionListeners) listener();
}

export function getResearchAgentSession(): ResearchAgentSession | null {
  return session;
}

export function useResearchAgentSession(): ResearchAgentSession | null {
  return useSyncExternalStore(
    listener => {
      sessionListeners.add(listener);
      return () => {
        sessionListeners.delete(listener);
      };
    },
    () => session,
    () => null,
  );
}

/** Test helper. */
export function resetResearchAgentSession(): void {
  setResearchAgentSession(null);
}

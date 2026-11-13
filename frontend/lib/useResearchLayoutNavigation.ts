import { useLayoutApi } from "@tokenring-ai/one-frontend/layout/context.ts";
import { useLayout, usePaneLink } from "@tokenring-ai/one-frontend/layout/hooks.ts";
import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { RESEARCH_ITEM_VIEW_ID, RESEARCH_TOPIC_VIEW_ID } from "../ids.ts";
import { RESEARCH_ROOT, researchItemPath } from "./paths.ts";
import { clearItemDraftsInTopic, moveItemDraft, setItemDraft } from "./researchStore.ts";

const itemKey = (topicName: string, itemName: string) => `${topicName}/${itemName}`;

/**
 * Navigation between the Research views. Opening a dossier navigates to its
 * URL; the landing tabs have done their job then, so they close.
 */
export function useResearchLayoutNavigation() {
  const open = usePaneLink();
  const layout = useLayout();
  const api = useLayoutApi();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const openItem = useCallback(
    (topicName: string, itemName: string) => {
      open(RESEARCH_ITEM_VIEW_ID, { topicName, itemName });
      layout.close(RESEARCH_TOPIC_VIEW_ID);
    },
    [open, layout],
  );

  /** Closes a deleted dossier's tab and drops its draft; leaves its URL if we are on it. */
  const closeItem = useCallback(
    (topicName: string, itemName: string) => {
      layout.close(RESEARCH_ITEM_VIEW_ID, { topicName, itemName });
      setItemDraft(itemKey(topicName, itemName), null);
      if (pathname === researchItemPath(topicName, itemName)) void navigate(RESEARCH_ROOT);
    },
    [layout, navigate, pathname],
  );

  /** After a topic is deleted: closes the tab of every dossier in it and drops their drafts. */
  const closeTopic = useCallback(
    (topicName: string) => {
      for (const panel of Object.values(api.store.getState().panels)) {
        if (panel.viewId === RESEARCH_ITEM_VIEW_ID && panel.params.topicName === topicName) api.close(panel.key);
      }
      clearItemDraftsInTopic(topicName);
      const topicPath = `${RESEARCH_ROOT}/${encodeURIComponent(topicName)}`;
      if (pathname === topicPath || pathname.startsWith(`${topicPath}/`)) {
        layout.close(RESEARCH_TOPIC_VIEW_ID);
        void navigate(RESEARCH_ROOT);
      }
    },
    [api, layout, navigate, pathname],
  );

  /**
   * After a dossier is renamed, moved or saved as a copy: its tab is replaced by
   * one for the new name (a panel's params never change), and its unsaved draft
   * moves with it. The new tab takes focus only if the old one had it.
   */
  const moveItem = useCallback(
    (from: { topicName: string; itemName: string }, to: { topicName: string; itemName: string }) => {
      moveItemDraft(itemKey(from.topicName, from.itemName), itemKey(to.topicName, to.itemName));
      const wasActive = pathname === researchItemPath(from.topicName, from.itemName);
      layout.close(RESEARCH_ITEM_VIEW_ID, from);
      open(RESEARCH_ITEM_VIEW_ID, to, { focus: wasActive });
    },
    [layout, open, pathname],
  );

  return { openItem, closeItem, closeTopic, moveItem };
}

import { useDashboardApi } from "@tokenring-ai/one-frontend/dock/DashboardApiContext.tsx";
import { openInMainArea } from "@tokenring-ai/one-frontend/dock/layout/mainArea.ts";
import { setPanelBadge } from "@tokenring-ai/one-frontend/dock/panelBadges.ts";
import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { RESEARCH_DASHBOARD_ID, RESEARCH_ITEM_VIEW, RESEARCH_SIDEBAR_VIEWS } from "../manifest.ts";
import { RESEARCH_ROOT, researchItemKey, researchItemPath } from "./paths.ts";
import { clearItemDraftsInTopic, moveItemDraft, setItemDraft } from "./researchStore.ts";

/**
 * Navigation between the Research views. Each destination opens its panel in
 * the main area right away (so a closed panel re-opens even when the URL does
 * not change) and then updates the URL. On another dashboard it only
 * navigates, which lands the user on the Research dashboard.
 */
export function useResearchNavigation() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const dashboard = useDashboardApi();
  const onDashboard = dashboard.dashboardId === RESEARCH_DASHBOARD_ID;

  const openItem = useCallback(
    (topicName: string, itemName: string) => {
      if (onDashboard) {
        openInMainArea(dashboard, RESEARCH_ITEM_VIEW, { topicName, itemName }, { sidebarViews: RESEARCH_SIDEBAR_VIEWS, fillPlaceholder: true });
      }
      void navigate(researchItemPath(topicName, itemName));
    },
    [dashboard, navigate, onDashboard],
  );

  /** Closes a dossier's panel after it is deleted, and leaves its URL if we are on it. */
  const closeItem = useCallback(
    (topicName: string, itemName: string) => {
      if (onDashboard) {
        const panelId = dashboard.hasView(RESEARCH_ITEM_VIEW, { topicName, itemName });
        if (panelId) {
          dashboard.closeView(panelId);
          setPanelBadge(panelId, null);
        }
      }
      setItemDraft(researchItemKey(topicName, itemName), null);
      if (pathname === researchItemPath(topicName, itemName)) void navigate(RESEARCH_ROOT);
    },
    [dashboard, navigate, onDashboard, pathname],
  );

  /**
   * After a topic is deleted: closes the panel of every dossier in it (not
   * just the one in the URL), drops their drafts and tab badges, and leaves the
   * URL if it points into the topic.
   */
  const closeTopic = useCallback(
    (topicName: string) => {
      if (onDashboard) {
        for (const panel of dashboard.listPanels()) {
          if (panel.viewId !== RESEARCH_ITEM_VIEW || panel.params.topicName !== topicName) continue;
          dashboard.closeView(panel.panelId);
          setPanelBadge(panel.panelId, null);
        }
      }
      clearItemDraftsInTopic(topicName);
      if (pathname.startsWith(`${RESEARCH_ROOT}/${encodeURIComponent(topicName)}/`)) void navigate(RESEARCH_ROOT);
    },
    [dashboard, navigate, onDashboard, pathname],
  );

  /**
   * After a dossier is renamed or moved: every panel showing it follows the new
   * name (so no tab points at a file that no longer exists), its unsaved draft
   * moves with it, and the URL follows when it pointed at the old name.
   */
  const moveItem = useCallback(
    (from: { topicName: string; itemName: string }, to: { topicName: string; itemName: string }) => {
      moveItemDraft(researchItemKey(from.topicName, from.itemName), researchItemKey(to.topicName, to.itemName));
      if (onDashboard) {
        for (const panel of dashboard.listPanels()) {
          if (panel.viewId !== RESEARCH_ITEM_VIEW || panel.params.topicName !== from.topicName || panel.params.itemName !== from.itemName) continue;
          dashboard.updateViewParams(panel.panelId, { topicName: to.topicName, itemName: to.itemName });
        }
      }
      if (pathname === researchItemPath(from.topicName, from.itemName)) void navigate(researchItemPath(to.topicName, to.itemName), { replace: true });
    },
    [dashboard, navigate, onDashboard, pathname],
  );

  /** Opens (or focuses) the chat panel for an agent without leaving the dashboard. */
  const openAgentChat = useCallback(
    (agentId: string) => {
      if (onDashboard) dashboard.openView("chat", { agentId }, { position: "right" });
      else void navigate(`/agent/${agentId}`);
    },
    [dashboard, navigate, onDashboard],
  );

  return { openItem, closeItem, closeTopic, moveItem, openAgentChat, onDashboard };
}

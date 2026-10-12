import { openInMainArea } from "@tokenring-ai/one-frontend/dock/layout/mainArea.ts";
import type { PluginFrontendContribution } from "@tokenring-ai/one-frontend/plugins/types.ts";
import { lazy } from "react";
import { z } from "zod";
import { RESEARCH_ROOT, researchItemPath } from "./lib/paths.ts";
import manifest, { RESEARCH_ITEM_VIEW, RESEARCH_SIDEBAR_VIEWS, researchItemViewManifest, researchTopicsViewManifest } from "./manifest.ts";

/** Both params are omitted for the landing panel the next opened dossier fills. */
export const ResearchItemParams = z.object({
  topicName: z.string().min(1).optional(),
  itemName: z.string().min(1).optional(),
});
export type ResearchItemParams = z.infer<typeof ResearchItemParams>;

function itemInstanceKey(params: ResearchItemParams): string {
  return params.topicName && params.itemName ? `${params.topicName}/${params.itemName}` : "new";
}

/**
 * The Research dashboard: a topic tree beside one panel per open dossier.
 * `/research/<topic>/<item>` opens (or focuses) that dossier; the active panel
 * keeps the URL in step. Discovered by `frontend/src/plugins/registry.ts`.
 */
export default {
  ...manifest,
  views: [
    { ...researchTopicsViewManifest, component: lazy(() => import("./views/ResearchTopicsView.tsx")) },
    {
      ...researchItemViewManifest,
      params: ResearchItemParams,
      instanceKey: itemInstanceKey,
      titleFor: params => params.itemName ?? "Research",
      component: lazy(() => import("./views/ResearchItemView.tsx")),
    },
  ],
  dashboards: [
    {
      ...manifest,
      routePath: "/research/:topicName?/:itemName?",
      defaultLayout: {
        kind: "row",
        sizes: [1, 3],
        children: [
          { kind: "panel", view: researchTopicsViewManifest.id },
          { kind: "panel", view: researchItemViewManifest.id },
        ],
      },
      onNavigate({ params }, api) {
        // A topic on its own only expands the tree; dossiers are what open a panel.
        if (!params.topicName || !params.itemName) return;
        openInMainArea(
          api,
          RESEARCH_ITEM_VIEW,
          { topicName: params.topicName, itemName: params.itemName },
          { sidebarViews: RESEARCH_SIDEBAR_VIEWS, fillPlaceholder: true },
        );
      },
      pathForActivePanel(panel) {
        if (panel?.viewId !== RESEARCH_ITEM_VIEW) return null;
        const { topicName, itemName } = panel.params;
        if (typeof topicName !== "string" || typeof itemName !== "string") return RESEARCH_ROOT;
        return researchItemPath(topicName, itemName);
      },
      documentTitle: ({ params }) => (params.itemName ? `${params.itemName} · Research` : "Research"),
    },
  ],
} satisfies PluginFrontendContribution;

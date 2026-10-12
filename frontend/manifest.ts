import type { ViewManifest } from "@tokenring-ai/one-frontend/dock/types.ts";
import type { PluginFrontendManifest } from "@tokenring-ai/one-frontend/plugins/types.ts";
import { FileText, FolderOpen, Search } from "lucide-react";

export const RESEARCH_DASHBOARD_ID = "research";
export const RESEARCH_TOPICS_VIEW = "research-topics";
export const RESEARCH_ITEM_VIEW = "research-item";

/** Navigator: research topics, their dossiers, and (on the Research dashboard) the attached research agent. */
export const researchTopicsViewManifest = {
  id: RESEARCH_TOPICS_VIEW,
  title: "Research topics",
  description: "Research topics and the markdown dossiers inside them",
  icon: FolderOpen,
  availableOn: ["any"],
  defaultSize: { width: 300, height: 400 },
  minimumSize: { width: 240, height: 160 },
  tags: ["research"],
} satisfies ViewManifest;

/**
 * One dossier per panel: markdown preview or editor with save / save-as /
 * delete. Without params the panel is the "Start researching" landing that
 * the next opened item fills in place.
 */
export const researchItemViewManifest = {
  id: RESEARCH_ITEM_VIEW,
  title: "Research item",
  description: "Preview or edit one research dossier",
  icon: FileText,
  availableOn: [],
  instanceable: true,
  renderer: "always",
  minimumSize: { width: 360, height: 240 },
  tags: ["research"],
} satisfies ViewManifest;

/** Views that act as the Research dashboard's navigator; item panels never tab into their group. */
export const RESEARCH_SIDEBAR_VIEWS: readonly string[] = [RESEARCH_TOPICS_VIEW];

/**
 * Metadata for the research dashboard shipped by this plugin. The frontend
 * merges this into its registry and derives the SPA server routes from it.
 */
export default {
  id: RESEARCH_DASHBOARD_ID,
  path: "/research",
  label: "Research",
  shortLabel: "RE",
  description: "Topic-based research dossiers in markdown",
  group: "Build",
  icon: Search,
  iconClass: "text-indigo-500",
  gradient: "from-indigo-500 to-violet-600",
  defaultPinned: true,
  views: [researchTopicsViewManifest, researchItemViewManifest],
} satisfies PluginFrontendManifest;

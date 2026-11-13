import type { PluginLayoutManifest } from "@tokenring-ai/one-frontend/plugins/layoutTypes.ts";
import { Search } from "lucide-react";
import {
  RESEARCH_APP_ID,
  RESEARCH_APP_PATH,
  RESEARCH_ITEM_VIEW_ID,
  RESEARCH_START_VIEW_ID,
  RESEARCH_TOPIC_VIEW_ID,
  RESEARCH_TOPICS_VIEW_ID,
  RESEARCH_VIEW_KIND,
} from "./ids.ts";

/**
 * Research: the topic tree on the left, one tab per open dossier on the right,
 * and the attached research agent's chat beside them. Routes: `/research`,
 * `/research/<topic>` (expands the topic), `/research/<topic>/<item>`.
 */
export const RESEARCH_APP = {
  id: RESEARCH_APP_ID,
  path: RESEARCH_APP_PATH,
  label: "Research",
  shortLabel: "RE",
  description: "Topic-based research dossiers in markdown",
  group: "Build",
  icon: Search,
  iconClass: "text-indigo-500",
  gradient: "from-indigo-500 to-violet-600",
  defaultPinned: true,
  views: [RESEARCH_TOPICS_VIEW_ID, RESEARCH_START_VIEW_ID, RESEARCH_TOPIC_VIEW_ID, RESEARCH_ITEM_VIEW_ID, "chat"],
  primaryKind: RESEARCH_VIEW_KIND,
  placement: { agent: "right" },
  layout: {
    split: "row",
    sizes: [1, 3],
    children: [
      { presenter: "single", accepts: ["navigator"], items: [RESEARCH_TOPICS_VIEW_ID] },
      { presenter: "tabs", accepts: [RESEARCH_VIEW_KIND], items: [RESEARCH_START_VIEW_ID], primary: true },
    ],
  },
} satisfies PluginLayoutManifest["apps"][number];

export default {
  apps: [RESEARCH_APP],
  kinds: [{ id: RESEARCH_VIEW_KIND, label: "Research", plural: "research tabs" }],
} satisfies PluginLayoutManifest;

import { defineView } from "@tokenring-ai/one-frontend/layout/define.ts";
import type { PluginLayoutViews } from "@tokenring-ai/one-frontend/plugins/layoutTypes.ts";
import { FileText, FolderOpen, Search } from "lucide-react";
import { lazy } from "react";
import { RESEARCH_ITEM_VIEW_ID, RESEARCH_START_VIEW_ID, RESEARCH_TOPIC_VIEW_ID, RESEARCH_TOPICS_VIEW_ID, RESEARCH_VIEW_KIND } from "./ids.ts";

const ResearchTopicsPane = lazy(() => import("./panes/ResearchTopicsPane.tsx"));
const ResearchLandingPane = lazy(() => import("./panes/ResearchLandingPane.tsx"));
const ResearchItemPane = lazy(() => import("./panes/ResearchItemPane.tsx"));

export default {
  views: [
    defineView({
      id: RESEARCH_TOPICS_VIEW_ID,
      kind: "navigator",
      title: "Research topics",
      description: "Research topics and the markdown dossiers inside them",
      icon: FolderOpen,
      closable: false,
      component: ResearchTopicsPane,
    }),
    // `/research`: describe a topic to research; closes once a dossier is opened.
    defineView({
      id: RESEARCH_START_VIEW_ID,
      landing: true,
      kind: RESEARCH_VIEW_KIND,
      title: "Research",
      description: "Start a research agent on a new topic",
      icon: Search,
      route: "",
      component: ResearchLandingPane,
    }),
    // `/research/<topic>` only expands the topic in the navigator; the landing is shown meanwhile.
    defineView({
      id: RESEARCH_TOPIC_VIEW_ID,
      kind: RESEARCH_VIEW_KIND,
      title: "Research",
      description: "Start a research agent on a new topic",
      icon: Search,
      route: ":topicName",
      instanceKey: () => "topic",
      component: ResearchLandingPane,
    }),
    // One dossier per tab: markdown preview or editor with save / save-as / move / delete.
    defineView({
      id: RESEARCH_ITEM_VIEW_ID,
      kind: RESEARCH_VIEW_KIND,
      title: params => params.itemName ?? "Research",
      description: "Preview or edit one research dossier",
      icon: FileText,
      route: ":topicName/:itemName",
      instanceKey: params => `${params.topicName ?? ""}/${params.itemName ?? ""}`,
      component: ResearchItemPane,
    }),
  ],
} satisfies PluginLayoutViews;

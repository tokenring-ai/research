import { Search } from "lucide-react";
import type { PluginAppManifest } from "@tokenring-ai/one-frontend/plugins/types.ts";

/**
 * Metadata for the research app shipped by this plugin. The frontend merges
 * this into its app registry and derives the SPA server routes from it.
 */
export default {
  id: "research",
  path: "/research",
  label: "Research",
  shortLabel: "RE",
  description: "Topic-based research dossiers in markdown",
  group: "Build",
  icon: Search,
  iconClass: "text-indigo-500",
  gradient: "from-indigo-500 to-violet-600",
  defaultPinned: true,
} satisfies PluginAppManifest;

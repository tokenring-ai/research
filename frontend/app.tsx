import manifest from "./manifest.ts";
import ResearchApp from "./ResearchApp.tsx";
import type { PluginAppDefinition } from "@tokenring-ai/one-frontend/plugins/types.ts";

/**
 * The research app contributed to the TokenRing One frontend by this
 * plugin. Discovered by `frontend/src/plugins/registry.ts`.
 */
export default {
  ...manifest,
  routePath: "/research/:topicName?/:itemName?",
  component: ResearchApp,
} satisfies PluginAppDefinition;

import AgentTodoList from "@tokenring-ai/one-frontend/components/AgentTodoList.tsx";
import EmptyStateWithPrompt from "@tokenring-ai/one-frontend/components/ui/EmptyStateWithPrompt.tsx";
import { toastManager } from "@tokenring-ai/one-frontend/components/ui/toast.tsx";
import { useTopics } from "@tokenring-ai/one-frontend/rpc.ts";
import { Search } from "lucide-react";
import { useCallback } from "react";
import { useResearchAgentSession } from "../lib/researchStore.ts";

/**
 * The tab before a dossier is opened: browse existing research or describe a
 * new topic to start a research agent. The agent itself belongs to the topics
 * navigator, which publishes the `start` hook this prompt calls.
 */
export default function ResearchLandingPane() {
  const { data } = useTopics();
  const session = useResearchAgentSession();
  const topicCount = data?.topics.length ?? 0;

  const handleStartResearch = useCallback(
    async (query: string): Promise<boolean> => {
      if (!session) {
        toastManager.error("Open the Research topics panel to start a research agent", { duration: 5000 });
        return false;
      }
      return session.start(query);
    },
    [session],
  );

  return (
    <div className="h-full flex flex-col min-h-0">
      <EmptyStateWithPrompt
        icon={Search}
        iconGradient="from-indigo-500 to-violet-600"
        title="Start researching"
        descriptionWithContent={
          <>
            Select existing research from the <span className="font-medium text-secondary">Topics</span> panel to view it, or describe a new topic below to
            start a research agent.
          </>
        }
        descriptionEmpty={
          <>Describe what you want to research below. A research agent will search the web and write markdown findings into topics in the Topics panel.</>
        }
        hasContent={topicCount > 0}
        agentRunningMessage="A research agent is running in the chat panel. Select an item from the Topics panel to open it, or continue the conversation with the agent."
        hasAgent={!!session?.agentId}
        promptLabel="Research prompt"
        promptPlaceholder="e.g. Solid-state battery commercialization timeline 2024–2026"
        promptAriaLabel="Research query"
        submitLabel="Start research"
        submitAriaLabel="Start research agent"
        buttonVariant="indigo"
        onSubmit={handleStartResearch}
      />
      {session?.agentId && (
        <section aria-label="Research agent progress" className="shrink-0 mx-auto w-full max-w-xl px-4 pb-4">
          <AgentTodoList agentId={session.agentId} agentName="research agent" className="pl-5 border-t border-primary/40 pt-2" />
        </section>
      )}
    </div>
  );
}

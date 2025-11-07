import { Suspense } from "react";

import { AssistantChat } from "@/components/assistant/assistant-chat";
import { initializeAssistantSession, submitAssistantMessage, performUndo } from "@/app/assistant/actions";

export default async function AssistantPage() {
  const { sessionId, history } = await initializeAssistantSession();

  return (
    <main className="relative min-h-screen bg-gradient-to-b from-sky-100 via-white to-white dark:from-slate-950 dark:via-slate-950 dark:to-slate-950">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.25),transparent_60%)] dark:bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.15),transparent_55%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-1/2 -z-10 h-1/2 bg-[radial-gradient(circle_at_center,_rgba(165,180,252,0.18),transparent_60%)] dark:bg-[radial-gradient(circle_at_center,_rgba(129,140,248,0.15),transparent_60%)]" />
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-70 blur-3xl">
        <div className="mx-auto h-72 w-72 rounded-full bg-cyan-400/20 dark:bg-indigo-500/20" />
      </div>
      <Suspense fallback={<div className="px-6 py-12 text-sm text-slate-500 dark:text-slate-300">Menyiapkan Assistant...</div>}>
        <AssistantChat
          initialSessionId={sessionId}
          initialTurns={history}
          onSend={submitAssistantMessage}
          onUndo={performUndo}
        />
      </Suspense>
    </main>
  );
}

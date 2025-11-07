"use client";

import type { ReactNode } from "react";

import { useRecurringRunner } from "@/hooks/use-recurring-runner";
import { SecurityGate } from "@/components/security/security-gate";
import { SyncQueueProvider } from "@/hooks/use-sync-queue";

interface AppBootstrapProps {
  children: ReactNode;
}

export function AppBootstrap({ children }: AppBootstrapProps) {
  useRecurringRunner();
  return (
    <SyncQueueProvider>
      <SecurityGate>{children}</SecurityGate>
    </SyncQueueProvider>
  );
}

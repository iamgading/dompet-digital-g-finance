import type { ReactNode } from "react";

import { SyncQueueProvider } from "@/hooks/use-sync-queue";

export default function QuickStandaloneLayout({ children }: { children: ReactNode }) {
  return <SyncQueueProvider>{children}</SyncQueueProvider>;
}


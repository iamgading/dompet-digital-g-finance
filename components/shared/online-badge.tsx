"use client";

import { useOnlineStatus } from "@/hooks/use-online-status";
import { cn } from "@/lib/utils";

export function OnlineBadge() {
  const isOnline = useOnlineStatus();

  return (
    <span
      suppressHydrationWarning
      aria-hidden={isOnline}
      className={cn(
        "flex items-center gap-2 rounded-full border border-red-500/30 bg-red-500/20 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-red-700 shadow-sm backdrop-blur transition-all duration-150 ease-out dark:border-red-400/30 dark:bg-red-500/10 dark:text-red-200",
        isOnline ? "hidden" : "inline-flex",
      )}
    >
      <span className="h-2 w-2 rounded-full bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.75)] dark:bg-red-400" />
      Offline
    </span>
  );
}

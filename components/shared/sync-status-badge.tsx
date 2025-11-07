"use client";

import { Check, Cloud, CloudOff, Loader2, TriangleAlert } from "lucide-react";

import { useSyncQueue } from "@/hooks/use-sync-queue";
import { cn } from "@/lib/utils";

export function SyncStatusBadge() {
  const { online, syncing, pendingCount, lastError } = useSyncQueue();

  const isHealthy = online && !syncing && pendingCount === 0 && !lastError;
  const isWarning = online && !syncing && pendingCount > 0;
  const isError = !online || Boolean(lastError);

  let icon = <Cloud className="h-4 w-4" aria-hidden="true" />;
  let label = "Sinkron";

  if (syncing) {
    icon = <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />;
    label = "Sinkronisasi...";
  } else if (isError) {
    icon = !online ? <CloudOff className="h-4 w-4" aria-hidden="true" /> : <TriangleAlert className="h-4 w-4" aria-hidden="true" />;
    label = !online ? "Offline" : "Retry diperlukan";
  } else if (isWarning) {
    icon = <Cloud className="h-4 w-4" aria-hidden="true" />;
    label = pendingCount === 1 ? "1 antrean" : `${pendingCount} antrean`;
  }

  return (
    <span
      className={cn(
        "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition",
        isHealthy && "border-emerald-400/40 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-emerald-200",
        syncing && "border-cyan-400/40 bg-cyan-500/10 text-cyan-700 dark:border-cyan-500/40 dark:bg-cyan-500/10 dark:text-cyan-200",
        isWarning && "border-amber-400/40 bg-amber-500/10 text-amber-700 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-200",
        isError && "border-red-400/40 bg-red-500/10 text-red-700 dark:border-red-400/30 dark:bg-red-500/10 dark:text-red-200",
      )}
    >
      {icon}
      <span className="flex items-center gap-1">
        {label}
        {isHealthy ? <Check className="h-3 w-3" aria-hidden="true" /> : null}
      </span>
    </span>
  );
}

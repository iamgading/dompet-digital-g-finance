import type { ReactNode } from "react";

import { AppBootstrap } from "@/components/app-bootstrap";
import { getCachedCashflowSummary, getCachedPockets, getCachedTotalBalance } from "@/lib/cache/data";
import { getActiveProfileId } from "@/lib/repo/profiles";

export default async function MainLayout({ children }: { children: ReactNode }) {
  const profileId = await getActiveProfileId();
  await Promise.all([
    getCachedTotalBalance(profileId),
    getCachedPockets(profileId),
    getCachedCashflowSummary(profileId),
  ]);
  return <AppBootstrap>{children}</AppBootstrap>;
}

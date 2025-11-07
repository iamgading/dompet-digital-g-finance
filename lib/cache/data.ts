import { unstable_cache } from "next/cache";

import { getCashflowSummaryByMonth, getCashflowSummaryByRange } from "@/lib/repo/analytics";
import { getPockets as repoGetPockets, getTotalBalance as repoGetTotalBalance } from "@/lib/repo/pockets";
import { CACHE_TAGS } from "@/lib/cache/tags";
import type { CashflowRangePreset } from "@/app/actions/analytics";

export const getCachedTotalBalance = unstable_cache(
  async (profileId: string) => {
    const total = await repoGetTotalBalance(profileId);
    return total;
  },
  ["dashboard-total-balance"],
  {
    tags: [CACHE_TAGS.totalBalance],
    revalidate: 60,
  },
);

export const getCachedPockets = unstable_cache(
  async (profileId: string) => {
    const pockets = await repoGetPockets(profileId);
    return pockets;
  },
  ["dashboard-pockets"],
  {
    tags: [CACHE_TAGS.pockets],
    revalidate: 60,
  },
);

type CashflowCacheInput = {
  month?: string;
  range?: CashflowRangePreset;
};

function resolveRangeDates(range: CashflowRangePreset) {
  const now = new Date();
  const to = new Date(now);
  to.setHours(23, 59, 59, 999);

  const from = new Date(now);
  from.setHours(0, 0, 0, 0);

  if (range === "90d") {
    from.setDate(from.getDate() - 89);
  } else if (range === "180d") {
    from.setDate(from.getDate() - 179);
  } else if (range === "ytd") {
    from.setMonth(0, 1);
  } else {
    from.setDate(from.getDate() - 29);
  }

  return { from, to };
}

export const getCachedCashflowSummary = unstable_cache(
  async (profileId: string, input?: CashflowCacheInput) => {
    if (input?.month) {
      let target = new Date(input.month);
      if (Number.isNaN(target.getTime())) {
        target = new Date();
      }
      return getCashflowSummaryByMonth(target, profileId);
    }

    const range = input?.range ?? "30d";
    const { from, to } = resolveRangeDates(range);
    return getCashflowSummaryByRange(profileId, from, to);
  },
  ["dashboard-cashflow"],
  {
    tags: [CACHE_TAGS.cashflow],
    revalidate: 60,
  },
);

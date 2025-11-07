import { unstable_cache } from "next/cache";

import {
  computePocketStats,
  getPocketCashflowSeries,
  type DateRange,
} from "@/lib/repo/pocket-insight";
import { CACHE_TAGS } from "@/lib/cache/tags";

function toDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date value: ${value}`);
  }
  return date;
}

export const getCachedPocketStats = unstable_cache(
  async (profileId: string, pocketId: string, fromISO: string, toISO: string) => {
    const range: DateRange = {
      from: toDate(fromISO),
      to: toDate(toISO),
    };
    return computePocketStats(pocketId, range, profileId);
  },
  ["pocket-insight-stats"],
  {
    tags: [CACHE_TAGS.transactions],
    revalidate: 60,
  },
);

export const getCachedPocketCashflow = unstable_cache(
  async (
    profileId: string,
    pocketId: string,
    granularity: "daily" | "weekly" | "monthly",
    fromISO: string,
    toISO: string,
  ) => {
    const range: DateRange = {
      from: toDate(fromISO),
      to: toDate(toISO),
    };
    return getPocketCashflowSeries(pocketId, granularity, range, profileId);
  },
  ["pocket-insight-cashflow"],
  {
    tags: [CACHE_TAGS.transactions],
    revalidate: 60,
  },
);

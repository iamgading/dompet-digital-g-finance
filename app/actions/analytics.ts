"use server";

import { getPocketSummaries } from "@/lib/repo/analytics";
import { generateInsights } from "@/lib/insight";
import { getCachedCashflowSummary, getCachedTotalBalance } from "@/lib/cache/data";
import { getActiveProfileId } from "@/app/actions/profile";

type ActionSuccess<T> = { success: true; data: T };
type ActionFailure = { success: false; error: string };

function success<T>(data: T): ActionSuccess<T> {
  return { success: true, data };
}

function failure(error: unknown): ActionFailure {
  const message = error instanceof Error ? error.message : "Terjadi kesalahan.";
  console.error("[analytics actions]", error);
  return { success: false, error: message };
}

export type CashflowRangePreset = "30d" | "90d" | "180d" | "ytd";

export async function getCashflowSummary(input?: { month?: string; range?: CashflowRangePreset }) {
  try {
    const profileId = await getActiveProfileId();
    const summary = await getCachedCashflowSummary(profileId, input);
    return success(summary);
  } catch (error) {
    return failure(error);
  }
}

export async function getInsights() {
  try {
    const profileId = await getActiveProfileId();
    const [pockets, total] = await Promise.all([
      getPocketSummaries(profileId),
      getCachedTotalBalance(profileId),
    ]);

    const insights = generateInsights({
      pockets: pockets.map((pocket) => ({
        name: pocket.name,
        balance: pocket.balance,
        monthlyBudget: pocket.monthlyBudget,
      })),
      totalBalance: total,
    });

    return success(insights);
  } catch (error) {
    return failure(error);
  }
}

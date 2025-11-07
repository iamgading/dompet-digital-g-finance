"use server";

import { revalidatePath, revalidateTag } from "next/cache";

import {
  ZPocketInsightGranularity,
  ZPocketInsightRange,
  ZPocketInsightTxnFilter,
  ZPocketNoteUpdate,
} from "@/lib/validators";
import {
  findPocketById,
  listPocketTransactions as repoListPocketTransactions,
  savePocketNote,
} from "@/lib/repo/pocket-insight";
import { getCachedPocketStats, getCachedPocketCashflow } from "@/lib/cache/pocket-insight";
import { CACHE_TAGS } from "@/lib/cache/tags";
import { getActiveProfileId } from "@/app/actions/profile";

type ActionSuccess<T> = { success: true; data: T };
type ActionFailure = { success: false; error: string };

function success<T>(data: T): ActionSuccess<T> {
  return { success: true, data };
}

function failure(error: unknown): ActionFailure {
  const message =
    error instanceof Error ? error.message : "Terjadi kesalahan yang tidak diketahui.";
  console.error("[pocket-actions]", error);
  return { success: false, error: message };
}

export async function getPocketById(pocketId: string) {
  try {
    const id = ZPocketNoteUpdate.shape.pocketId.parse(pocketId);
    const profileId = await getActiveProfileId();
    const pocket = await findPocketById(id, profileId);
    if (!pocket) {
      throw new Error("Pocket tidak ditemukan.");
    }
    return success(pocket);
  } catch (error) {
    return failure(error);
  }
}

export async function getPocketStats(
  pocketId: string,
  range: { from: Date; to: Date },
) {
  try {
    const id = ZPocketNoteUpdate.shape.pocketId.parse(pocketId);
    const parsedRange = ZPocketInsightRange.parse(range);
    const profileId = await getActiveProfileId();
    const data = await getCachedPocketStats(
      profileId,
      id,
      parsedRange.from.toISOString(),
      parsedRange.to.toISOString(),
    );
    return success(data);
  } catch (error) {
    return failure(error);
  }
}

export async function getPocketCashflowSeries(
  pocketId: string,
  granularity: "daily" | "weekly" | "monthly",
  range: { from: Date; to: Date },
) {
  try {
    const id = ZPocketNoteUpdate.shape.pocketId.parse(pocketId);
    const parsedGranularity = ZPocketInsightGranularity.parse(granularity);
    const parsedRange = ZPocketInsightRange.parse(range);
    const profileId = await getActiveProfileId();
    const data = await getCachedPocketCashflow(
      profileId,
      id,
      parsedGranularity,
      parsedRange.from.toISOString(),
      parsedRange.to.toISOString(),
    );
    return success(data);
  } catch (error) {
    return failure(error);
  }
}

export async function listPocketTransactions(
  pocketId: string,
  filter: {
    from?: Date;
    to?: Date;
    type?: "income" | "expense";
    limit?: number;
    cursor?: string;
  } = {},
) {
  try {
    const id = ZPocketNoteUpdate.shape.pocketId.parse(pocketId);
    const parsedFilter = ZPocketInsightTxnFilter.parse(filter);
    const profileId = await getActiveProfileId();
    const results = await repoListPocketTransactions(id, parsedFilter, profileId);
    return success(results);
  } catch (error) {
    return failure(error);
  }
}

export async function updatePocketNote(pocketId: string, note: string) {
  try {
    const payload = ZPocketNoteUpdate.parse({ pocketId, note });
    const profileId = await getActiveProfileId();
    const updated = await savePocketNote(payload.pocketId, payload.note ?? "", profileId);
    revalidateTag(CACHE_TAGS.pockets);
    revalidatePath("/");
    return success(updated);
  } catch (error) {
    return failure(error);
  }
}

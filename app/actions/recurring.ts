"use server";

import { revalidatePath } from "next/cache";

import {
  ZRecurringUpsert,
  ZRecurringDelete,
  ZRunRecurring,
  type RecurringScheduleInput,
} from "@/lib/validators";
import {
  deleteRecurring as repoDeleteRecurring,
  listRecurring as repoListRecurring,
  runDueRecurring as repoRunDueRecurring,
  runRecurringNow as repoRunRecurringNow,
  upsertRecurring as repoUpsertRecurring,
} from "@/lib/repo/recurring";
import { parseSchedule } from "@/lib/schedule";
import { getActiveProfileId } from "@/app/actions/profile";

type ActionSuccess<T> = { success: true; data: T };
type ActionFailure = { success: false; error: string };

function success<T>(data: T): ActionSuccess<T> {
  return { success: true, data };
}

function failure(error: unknown): ActionFailure {
  const message = error instanceof Error ? error.message : "Terjadi kesalahan.";
  console.error("[recurring actions]", error);
  return { success: false, error: message };
}

export async function listRecurring() {
  try {
    const profileId = await getActiveProfileId();
    const rows = await repoListRecurring(profileId);
    return success(
      rows.map((row) => ({
        ...row,
        schedule: parseSchedule(row.schedule),
      })),
    );
  } catch (error) {
    return failure(error);
  }
}

export async function createOrUpdateRecurring(input: {
  id?: string;
  name: string;
  type: "income" | "expense";
  amount: number;
  pocketId: string;
  schedule: RecurringScheduleInput;
  autoPost?: boolean;
  nextRunAt?: Date;
}) {
  try {
    const payload = ZRecurringUpsert.parse(input);
    const profileId = await getActiveProfileId();
    const recurring = await repoUpsertRecurring(
      {
        id: payload.id,
        name: payload.name,
        type: payload.type,
        amount: payload.amount,
        pocketId: payload.pocketId,
        schedule: payload.schedule,
        autoPost: payload.autoPost,
        nextRunAt: payload.nextRunAt,
      },
      profileId,
    );
    await revalidatePath("/");
    await revalidatePath("/recurring");
    return success({
      ...recurring,
      schedule: payload.schedule,
    });
  } catch (error) {
    return failure(error);
  }
}

export async function deleteRecurring(input: { id: string }) {
  try {
    const payload = ZRecurringDelete.parse(input);
    const profileId = await getActiveProfileId();
    const deleted = await repoDeleteRecurring(payload.id, profileId);
    await revalidatePath("/recurring");
    return success(deleted);
  } catch (error) {
    return failure(error);
  }
}

export async function runRecurringNow(input: { id: string }) {
  try {
    const payload = ZRunRecurring.parse(input);
    const profileId = await getActiveProfileId();
    const result = await repoRunRecurringNow(payload.id, profileId);
    await revalidatePath("/");
    await revalidatePath("/recurring");
    return success(result);
  } catch (error) {
    return failure(error);
  }
}

export async function runDueRecurring() {
  try {
    const profileId = await getActiveProfileId();
    const result = await repoRunDueRecurring(profileId, true);
    if (result.executed.length > 0) {
      await revalidatePath("/");
      await revalidatePath("/recurring");
    }
    return success(result);
  } catch (error) {
    return failure(error);
  }
}

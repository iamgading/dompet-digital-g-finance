"use server";

import { getActiveProfileId } from "@/app/actions/profile";
import { getCashflowCalendarEntries } from "@/lib/repo/calendar";

type ActionSuccess<T> = { success: true; data: T };
type ActionFailure = { success: false; error: string };

function success<T>(data: T): ActionSuccess<T> {
  return { success: true, data };
}

function failure(error: unknown): ActionFailure {
  const message = error instanceof Error ? error.message : "Terjadi kesalahan.";
  console.error("[calendar actions]", error);
  return { success: false, error: message };
}

export async function getCashflowCalendar(input?: { month?: string }) {
  try {
    const profileId = await getActiveProfileId();
    const month = input?.month ? new Date(input.month) : new Date();
    const data = await getCashflowCalendarEntries(profileId, { month });
    return success(data);
  } catch (error) {
    return failure(error);
  }
}

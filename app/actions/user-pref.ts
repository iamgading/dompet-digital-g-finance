"use server";

import { revalidatePath, revalidateTag, unstable_cache } from "next/cache";

import {
  ensureUserPref,
  updateUserPrefSettings,
  type UserPrefRecord,
} from "@/lib/repo/user-pref";
import { ZUserPrefUpdate, type UserPrefUpdateInput } from "@/lib/validators";
import { CACHE_TAGS } from "@/lib/cache/tags";
import { defaultUserPref, type UserPrefSettings } from "@/lib/types/user-pref";

type ActionSuccess<T> = { success: true; data: T };
type ActionFailure = { success: false; error: string };

function success<T>(data: T): ActionSuccess<T> {
  return { success: true, data };
}

function failure(error: unknown): ActionFailure {
  const message = error instanceof Error ? error.message : "Terjadi kesalahan.";
  console.error("[user-pref]", error);
  return { success: false, error: message };
}

function mapUserPref(record: UserPrefRecord | null): UserPrefSettings {
  if (!record) {
    return defaultUserPref;
  }

  return {
    id: record.id,
    currency: (record.currency as UserPrefSettings["currency"]) ?? defaultUserPref.currency,
    locale: (record.locale as UserPrefSettings["locale"]) ?? defaultUserPref.locale,
    theme: (record.theme as UserPrefSettings["theme"]) ?? defaultUserPref.theme,
    uiAnimationsEnabled: record.uiAnimationsEnabled ?? defaultUserPref.uiAnimationsEnabled,
    activeProfileId: record.activeProfileId ?? defaultUserPref.activeProfileId,
  };
}

export const getCachedUserPref = unstable_cache(
  async () => {
    const record = await ensureUserPref();
    return mapUserPref(record);
  },
  ["user-pref-settings"],
  {
    tags: [CACHE_TAGS.userPref],
    revalidate: 60,
  },
);

export async function updateUserPref(input: UserPrefUpdateInput) {
  try {
    const payload = ZUserPrefUpdate.parse(input);
    const updated = await updateUserPrefSettings({
      currency: payload.currency,
      locale: payload.locale,
      theme: payload.theme,
      uiAnimationsEnabled: payload.uiAnimationsEnabled,
    });

    revalidateTag(CACHE_TAGS.userPref);
    revalidatePath("/");
    revalidatePath("/settings/profile");
    revalidatePath("/quick");

    return success({ pref: mapUserPref(updated) });
  } catch (error) {
    return failure(error);
  }
}

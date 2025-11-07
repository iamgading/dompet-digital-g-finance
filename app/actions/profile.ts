"use server";

import { revalidatePath, revalidateTag } from "next/cache";

import { ZProfileCreate, ZSetActiveProfile } from "@/lib/validators";
import {
  createProfile as repoCreateProfile,
  getActiveProfile as repoGetActiveProfile,
  getActiveProfileId as repoGetActiveProfileId,
  listProfiles as repoListProfiles,
  setActiveProfile as repoSetActiveProfile,
} from "@/lib/repo/profiles";
import { CACHE_TAGS } from "@/lib/cache/tags";

type ActionSuccess<T> = { success: true; data: T };
type ActionFailure = { success: false; error: string };

function success<T>(data: T): ActionSuccess<T> {
  return { success: true, data };
}

function failure(error: unknown): ActionFailure {
  const message = error instanceof Error ? error.message : "Terjadi kesalahan.";
  console.error("[profile-actions]", error);
  return { success: false, error: message };
}

export async function getActiveProfile() {
  try {
    const profile = await repoGetActiveProfile();
    return success(profile);
  } catch (error) {
    return failure(error);
  }
}

export async function getActiveProfileId() {
  return repoGetActiveProfileId();
}

export async function listProfiles() {
  try {
    const profiles = await repoListProfiles();
    return success(profiles);
  } catch (error) {
    return failure(error);
  }
}

export async function createProfile(input: { name: string; desc?: string | null; copyFromActive?: boolean }) {
  try {
    const payload = ZProfileCreate.parse(input ?? {});
    let cloneFromProfileId: string | null = null;
    if (payload.copyFromActive) {
      cloneFromProfileId = await repoGetActiveProfileId();
    }

    const profile = await repoCreateProfile({
      name: payload.name,
      desc: payload.desc,
      cloneFromProfileId,
    });

    revalidateTag(CACHE_TAGS.profiles);
    revalidatePath("/");
    return success(profile);
  } catch (error) {
    return failure(error);
  }
}

export async function setActiveProfile(profileId: string) {
  try {
    const { profileId: parsedId } = ZSetActiveProfile.parse({ profileId });
    const profile = await repoSetActiveProfile(parsedId);

    revalidateTag(CACHE_TAGS.userPref);
    revalidateTag(CACHE_TAGS.profiles);
    revalidateTag(CACHE_TAGS.totalBalance);
    revalidateTag(CACHE_TAGS.pockets);
    revalidateTag(CACHE_TAGS.cashflow);
    revalidateTag(CACHE_TAGS.transactions);
    revalidatePath("/");
    revalidatePath("/quick");
    return success(profile);
  } catch (error) {
    return failure(error);
  }
}

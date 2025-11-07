import { randomUUID } from "node:crypto";

import { getSupabaseAdminClient } from "@/lib/supabase";
import type { Database } from "@/lib/supabase";

type UserPrefRow = Database["public"]["Tables"]["UserPref"]["Row"];

export type UserPrefRecord = {
  id: string;
  currency: string;
  locale: string;
  theme: string;
  pinHash: string | null;
  biometricEnabled: boolean;
  passkeyCredentialId: string | null;
  passkeyPublicKey: string | null;
  passkeyCounter: number | null;
  passkeyTransports: string | null;
  passkeyCurrentChallenge: string | null;
  uiAnimationsEnabled: boolean;
  activeProfileId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function mapRow(row: UserPrefRow): UserPrefRecord {
  return {
    id: row.id,
    currency: row.currency,
    locale: row.locale,
    theme: row.theme,
    pinHash: row.pinHash,
    biometricEnabled: row.biometricEnabled,
    passkeyCredentialId: row.passkeyCredentialId,
    passkeyPublicKey: row.passkeyPublicKey,
    passkeyCounter: row.passkeyCounter,
    passkeyTransports: row.passkeyTransports,
    passkeyCurrentChallenge: row.passkeyCurrentChallenge,
    uiAnimationsEnabled: row.uiAnimationsEnabled,
    activeProfileId: row.activeProfileId,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  };
}

async function updateUserPrefById(id: string, patch: Partial<UserPrefRow>): Promise<UserPrefRecord> {
  const supabase = getSupabaseAdminClient();
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("UserPref")
    .update({ ...patch, updatedAt: nowIso })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(`Gagal memperbarui UserPref: ${error.message}`);
  }

  return mapRow(data);
}

async function getFirstUserPref(): Promise<UserPrefRecord | null> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("UserPref")
    .select("*")
    .order("createdAt", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Gagal memuat UserPref: ${error.message}`);
  }

  if (!data) return null;
  return mapRow(data);
}

export async function getUserPref() {
  return getFirstUserPref();
}

export async function ensureUserPref() {
  const existing = await getFirstUserPref();
  if (existing) return existing;

  const supabase = getSupabaseAdminClient();
  const nowIso = new Date().toISOString();
  const payload = {
    id: randomUUID(),
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  const { data, error } = await supabase.from("UserPref").insert(payload).select().single();

  if (error) {
    throw new Error(`Gagal membuat UserPref: ${error.message}`);
  }

  return mapRow(data);
}

export async function updatePin(hash: string | null) {
  const pref = await ensureUserPref();
  return updateUserPrefById(pref.id, { pinHash: hash });
}

export async function updateBiometric(enabled: boolean) {
  const pref = await ensureUserPref();
  return updateUserPrefById(pref.id, { biometricEnabled: enabled });
}

export async function savePasskeyCredential(data: {
  credentialId: string;
  publicKey: string;
  counter: number;
  transports?: string[];
}) {
  const pref = await ensureUserPref();
  return updateUserPrefById(pref.id, {
    passkeyCredentialId: data.credentialId,
    passkeyPublicKey: data.publicKey,
    passkeyCounter: data.counter,
    passkeyTransports: data.transports?.join(",") ?? null,
  });
}

export async function updatePasskeyCounter(counter: number) {
  const pref = await ensureUserPref();
  return updateUserPrefById(pref.id, { passkeyCounter: counter });
}

export async function setPasskeyChallenge(challenge: string | null) {
  const pref = await ensureUserPref();
  return updateUserPrefById(pref.id, { passkeyCurrentChallenge: challenge });
}

export async function clearPasskey() {
  const pref = await ensureUserPref();
  return updateUserPrefById(pref.id, {
    passkeyCredentialId: null,
    passkeyPublicKey: null,
    passkeyCounter: null,
    passkeyTransports: null,
  });
}

export async function updateUserPrefSettings(patch: {
  currency: string;
  locale: string;
  theme: string;
  uiAnimationsEnabled: boolean;
}) {
  const pref = await ensureUserPref();
  return updateUserPrefById(pref.id, {
    currency: patch.currency,
    locale: patch.locale,
    theme: patch.theme,
    uiAnimationsEnabled: patch.uiAnimationsEnabled,
  });
}

export async function setActiveProfileId(profileId: string) {
  const pref = await ensureUserPref();
  return updateUserPrefById(pref.id, { activeProfileId: profileId });
}

export async function clearActiveProfileId() {
  const pref = await ensureUserPref();
  return updateUserPrefById(pref.id, { activeProfileId: null });
}

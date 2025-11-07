"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";

import { getSupabaseAdminClient, type Database } from "@/lib/supabase";
import { ZBackupPayload, type BackupPayload } from "@/lib/validators";

type ActionSuccess<T> = { success: true; data: T };
type ActionFailure = { success: false; error: string };

function success<T>(data: T): ActionSuccess<T> {
  return { success: true, data };
}

function failure(error: unknown): ActionFailure {
  const message = error instanceof Error ? error.message : "Terjadi kesalahan";
  console.error("[backup actions]", error);
  return { success: false, error: message };
}

export async function exportBackupData() {
  try {
    const supabase = getSupabaseAdminClient();

    const [profilesRes, pocketsRes, transactionsRes, recurringRes, userPrefRes] = await Promise.all([
      supabase.from("Profile").select("*").order("createdAt", { ascending: true }).order("name", { ascending: true }),
      supabase.from("Pocket").select("*"),
      supabase.from("Transaction").select("*"),
      supabase.from("Recurring").select("*"),
      supabase.from("UserPref").select("*").order("createdAt", { ascending: true }).limit(1).maybeSingle(),
    ]);

    if (profilesRes.error) throw new Error(`Gagal memuat profile: ${profilesRes.error.message}`);
    if (pocketsRes.error) throw new Error(`Gagal memuat pocket: ${pocketsRes.error.message}`);
    if (transactionsRes.error) throw new Error(`Gagal memuat transaksi: ${transactionsRes.error.message}`);
    if (recurringRes.error) throw new Error(`Gagal memuat recurring: ${recurringRes.error.message}`);
    if (userPrefRes.error) throw new Error(`Gagal memuat userPref: ${userPrefRes.error.message}`);

    const backup: BackupPayload = {
      profiles: (profilesRes.data ?? []).map((profile) => ({
        id: profile.id,
        name: profile.name,
        desc: profile.desc ?? null,
        createdAt: profile.createdAt,
      })),
      pockets: (pocketsRes.data ?? []).map((pocket) => ({
        id: pocket.id,
        name: pocket.name,
        icon: pocket.icon ?? null,
        color: pocket.color ?? null,
        monthlyBudget: pocket.monthlyBudget,
        goalAmount: pocket.goalAmount,
        order: pocket.order,
        isActive: pocket.isActive,
        balance: pocket.balance,
        createdAt: pocket.createdAt,
        updatedAt: pocket.updatedAt,
        profileId: pocket.profileId,
      })),
      transactions: (transactionsRes.data ?? []).map((txn) => ({
        id: txn.id,
        type: txn.type,
        amount: txn.amount,
        date: txn.date,
        note: txn.note ?? null,
        pocketId: txn.pocketId,
        source: txn.source ?? null,
        externalRef: txn.externalRef ?? null,
        createdAt: txn.createdAt,
        updatedAt: txn.updatedAt,
        profileId: txn.profileId,
      })),
      recurring: (recurringRes.data ?? []).map((row) => ({
        id: row.id,
        name: row.name,
        type: row.type,
        amount: row.amount,
        schedule: row.schedule,
        pocketId: row.pocketId,
        nextRunAt: row.nextRunAt,
        lastRunAt: row.lastRunAt,
        autoPost: row.autoPost,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      })),
      userPref: userPrefRes.data
        ? {
            id: userPrefRes.data.id,
            currency: userPrefRes.data.currency,
            locale: userPrefRes.data.locale,
            theme: userPrefRes.data.theme,
            uiAnimationsEnabled: userPrefRes.data.uiAnimationsEnabled,
            pinHash: userPrefRes.data.pinHash ?? null,
            biometricEnabled: userPrefRes.data.biometricEnabled,
            passkeyCredentialId: userPrefRes.data.passkeyCredentialId ?? null,
            passkeyPublicKey: userPrefRes.data.passkeyPublicKey ?? null,
            passkeyCounter: userPrefRes.data.passkeyCounter ?? null,
            passkeyTransports: userPrefRes.data.passkeyTransports ?? null,
            passkeyCurrentChallenge: userPrefRes.data.passkeyCurrentChallenge ?? null,
            createdAt: userPrefRes.data.createdAt,
            updatedAt: userPrefRes.data.updatedAt,
            activeProfileId: userPrefRes.data.activeProfileId ?? null,
          }
        : null,
    };

    return success(backup);
  } catch (error) {
    return failure(error);
  }
}

type RestoreMode = "replace" | "merge";

async function deleteAllRecords(table: keyof Database["public"]["Tables"]) {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from(table).delete().neq("id", "");
  if (error) {
    throw new Error(`Gagal mengosongkan tabel ${table}: ${error.message}`);
  }
}

function toISO(value: string | Date) {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return new Date(value).toISOString();
}

export async function restoreBackupData(input: { payload: BackupPayload; mode?: RestoreMode }) {
  try {
    const payload = ZBackupPayload.parse(input.payload);
    const mode = input.mode ?? "replace";
    const supabase = getSupabaseAdminClient();

    if (mode === "replace") {
      // urutan delete memperhatikan foreign key
      await deleteAllRecords("Transaction");
      await deleteAllRecords("Recurring");
      await deleteAllRecords("Pocket");
      await deleteAllRecords("Profile");
      await deleteAllRecords("UserPref");
    }

    const providedProfiles = payload.profiles ?? [];
    const profileIdSet = new Set<string>();

    if (providedProfiles.length > 0) {
      const profileRows = providedProfiles.map((profile) => ({
        id: profile.id,
        name: profile.name,
        desc: profile.desc ?? null,
        createdAt: toISO(profile.createdAt),
      }));

      const { error } = await supabase.from("Profile").upsert(profileRows, { onConflict: "id" });
      if (error) {
        throw new Error(`Gagal menyimpan profile: ${error.message}`);
      }

      profileRows.forEach((profile) => profileIdSet.add(profile.id));
    }

    const referencedProfileIds = new Set<string>();
    for (const pocket of payload.pockets) {
      if (pocket.profileId) referencedProfileIds.add(pocket.profileId);
    }
    for (const txn of payload.transactions) {
      if (txn.profileId) referencedProfileIds.add(txn.profileId);
    }

    const missingProfiles = [...referencedProfileIds].filter((id) => !profileIdSet.has(id));
    if (missingProfiles.length > 0) {
      const placeholderProfiles = missingProfiles.map((id) => ({
        id,
        name: "Profil Import",
        desc: null,
        createdAt: new Date().toISOString(),
      }));
      const { error } = await supabase.from("Profile").upsert(placeholderProfiles, { onConflict: "id" });
      if (error) {
        throw new Error(`Gagal membuat profil tambahan: ${error.message}`);
      }
      placeholderProfiles.forEach((profile) => profileIdSet.add(profile.id));
    }

    let fallbackProfileId: string | null = null;
    if (profileIdSet.size === 0) {
      const profileId = randomUUID();
      const { error } = await supabase
        .from("Profile")
        .insert({
          id: profileId,
          name: "Pribadi",
          desc: "Profil hasil restore",
          createdAt: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Gagal membuat profil fallback: ${error.message}`);
      }

      profileIdSet.add(profileId);
      fallbackProfileId = profileId;
    }

    const resolveProfileId = (candidate?: string | null) => {
      if (candidate && profileIdSet.has(candidate)) {
        return candidate;
      }
      if (fallbackProfileId) {
        return fallbackProfileId;
      }
      const first = profileIdSet.values().next();
      if (!first.done) {
        return first.value;
      }
      throw new Error("Profil untuk data hasil restore tidak tersedia.");
    };

    if (payload.pockets.length) {
      const pocketRows = payload.pockets.map((pocket) => ({
        id: pocket.id,
        name: pocket.name,
        icon: pocket.icon ?? null,
        color: pocket.color ?? null,
        monthlyBudget: pocket.monthlyBudget,
        goalAmount: pocket.goalAmount,
        order: pocket.order,
        isActive: pocket.isActive,
        balance: pocket.balance,
        createdAt: toISO(pocket.createdAt),
        updatedAt: toISO(pocket.updatedAt),
        profileId: resolveProfileId(pocket.profileId),
      }));

      const { error } = await supabase.from("Pocket").upsert(pocketRows, { onConflict: "id" });
      if (error) {
        throw new Error(`Gagal menyimpan pocket: ${error.message}`);
      }
    }

    if (payload.transactions.length) {
      const txnRows = payload.transactions.map((txn) => ({
        id: txn.id,
        type: txn.type,
        amount: txn.amount,
        date: toISO(txn.date),
        note: txn.note ?? null,
        pocketId: txn.pocketId,
        source: txn.source ?? null,
        externalRef: txn.externalRef ?? null,
        createdAt: toISO(txn.createdAt),
        updatedAt: toISO(txn.updatedAt),
        profileId: resolveProfileId(txn.profileId),
      }));

      const { error } = await supabase.from("Transaction").upsert(txnRows, { onConflict: "id" });
      if (error) {
        throw new Error(`Gagal menyimpan transaksi: ${error.message}`);
      }
    }

    if (payload.recurring.length) {
      const recurringRows = payload.recurring.map((row) => ({
        id: row.id,
        name: row.name,
        type: row.type,
        amount: row.amount,
        schedule: row.schedule,
        pocketId: row.pocketId,
        nextRunAt: toISO(row.nextRunAt),
        lastRunAt: row.lastRunAt ? toISO(row.lastRunAt) : null,
        autoPost: row.autoPost,
        createdAt: toISO(row.createdAt),
        updatedAt: toISO(row.updatedAt),
      }));

      const { error } = await supabase.from("Recurring").upsert(recurringRows, { onConflict: "id" });
      if (error) {
        throw new Error(`Gagal menyimpan recurring: ${error.message}`);
      }
    }

    if (payload.userPref) {
      const prefRow = {
        id: payload.userPref.id,
        currency: payload.userPref.currency,
        locale: payload.userPref.locale,
        theme: payload.userPref.theme,
        pinHash: payload.userPref.pinHash ?? null,
        biometricEnabled: payload.userPref.biometricEnabled,
        passkeyCredentialId: payload.userPref.passkeyCredentialId ?? null,
        passkeyPublicKey: payload.userPref.passkeyPublicKey ?? null,
        passkeyCounter: payload.userPref.passkeyCounter ?? null,
        passkeyTransports: payload.userPref.passkeyTransports ?? null,
        passkeyCurrentChallenge: payload.userPref.passkeyCurrentChallenge ?? null,
        uiAnimationsEnabled: payload.userPref.uiAnimationsEnabled,
        createdAt: toISO(payload.userPref.createdAt),
        updatedAt: toISO(payload.userPref.updatedAt),
        activeProfileId: resolveProfileId(payload.userPref.activeProfileId ?? null),
      };

      const { error } = await supabase.from("UserPref").upsert([prefRow], { onConflict: "id" });
      if (error) {
        throw new Error(`Gagal menyimpan userPref: ${error.message}`);
      }
    }

    await revalidatePath("/");
    await revalidatePath("/recurring");
    return success({ ok: true });
  } catch (error) {
    return failure(error);
  }
}

import { randomUUID } from "node:crypto";

import { getSupabaseAdminClient } from "@/lib/supabase";
import type { Database } from "@/lib/supabase";
import { ensureUserPref, setActiveProfileId } from "@/lib/repo/user-pref";

type CreateProfileInput = {
  name: string;
  desc?: string | null;
  cloneFromProfileId?: string | null;
};

type ProfileRow = Database["public"]["Tables"]["Profile"]["Row"];

export function mapProfileRow(row: ProfileRow) {
  return {
    id: row.id,
    name: row.name,
    desc: row.desc,
    createdAt: new Date(row.createdAt),
  };
}

export async function listProfiles() {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("Profile")
    .select("*")
    .order("createdAt", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`Gagal memuat daftar profil: ${error.message}`);
  }

  return (data ?? []).map(mapProfileRow);
}

async function ensureDefaultProfile() {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("Profile")
    .select("*")
    .order("createdAt", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Gagal memeriksa profil default: ${error.message}`);
  }

  if (data) {
    return mapProfileRow(data);
  }

  const nowIso = new Date().toISOString();
  const payload = {
    id: randomUUID(),
    name: "Pribadi",
    desc: "Profil default",
    createdAt: nowIso,
  };

  const { data: inserted, error: insertError } = await supabase
    .from("Profile")
    .insert(payload)
    .select()
    .single();

  if (insertError) {
    throw new Error(`Gagal membuat profil default: ${insertError.message}`);
  }

  return mapProfileRow(inserted);
}

export async function getActiveProfile() {
  const pref = await ensureUserPref();
  const supabase = getSupabaseAdminClient();

  if (pref.activeProfileId) {
    const { data, error } = await supabase
      .from("Profile")
      .select("*")
      .eq("id", pref.activeProfileId)
      .maybeSingle();

    if (error) {
      throw new Error(`Gagal memuat profil aktif: ${error.message}`);
    }

    if (data) {
      return mapProfileRow(data);
    }
  }

  const fallback = await ensureDefaultProfile();
  if (pref.activeProfileId !== fallback.id) {
    await setActiveProfileId(fallback.id);
  }

  return fallback;
}

export async function getActiveProfileId() {
  const profile = await getActiveProfile();
  return profile.id;
}

export async function setActiveProfile(profileId: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.from("Profile").select("*").eq("id", profileId).maybeSingle();

  if (error) {
    throw new Error(`Gagal memuat profil: ${error.message}`);
  }

  if (!data) {
    throw new Error("Profil tidak ditemukan.");
  }

  const profile = mapProfileRow(data);
  const pref = await ensureUserPref();
  if (pref.activeProfileId !== profile.id) {
    await setActiveProfileId(profile.id);
  }

  return profile;
}

export async function createProfile({ name, desc, cloneFromProfileId }: CreateProfileInput) {
  const supabase = getSupabaseAdminClient();
  const trimmedDesc = desc?.trim() ? desc.trim() : null;
  const nowIso = new Date().toISOString();
  const profileId = randomUUID();

  const { data: profileRow, error: insertError } = await supabase
    .from("Profile")
    .insert({
      id: profileId,
      name,
      desc: trimmedDesc,
      createdAt: nowIso,
    })
    .select()
    .single();

  if (insertError) {
    throw new Error(`Gagal membuat profil: ${insertError.message}`);
  }

  if (cloneFromProfileId) {
    const { data: sourcePockets, error: pocketsError } = await supabase
      .from("Pocket")
      .select("*")
      .eq("profileId", cloneFromProfileId)
      .order("order", { ascending: true })
      .order("createdAt", { ascending: true });

    if (pocketsError) {
      throw new Error(`Gagal memuat pocket sumber: ${pocketsError.message}`);
    }

    if (sourcePockets && sourcePockets.length > 0) {
      const inserts = sourcePockets.map((pocket, index) => ({
        id: randomUUID(),
        name: pocket.name,
        icon: pocket.icon,
        color: pocket.color,
        note: pocket.note,
        monthlyBudget: pocket.monthlyBudget,
        goalAmount: pocket.goalAmount,
        order: pocket.order ?? index + 1,
        isActive: pocket.isActive,
        balance: 0,
        profileId,
        createdAt: nowIso,
        updatedAt: nowIso,
      }));

      const { error: insertPocketsError } = await supabase.from("Pocket").insert(inserts);
      if (insertPocketsError) {
        throw new Error(`Gagal menyalin pocket: ${insertPocketsError.message}`);
      }
    }
  }

  return mapProfileRow(profileRow);
}

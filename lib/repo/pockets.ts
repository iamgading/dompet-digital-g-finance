import { randomUUID } from "node:crypto";

import { getSupabaseAdminClient } from "@/lib/supabase";
import type { Database } from "@/lib/supabase";
import type { PocketUpsertInput } from "@/lib/validators";

type PocketUpsertWithProfile = PocketUpsertInput & { profileId: string };

type PocketRow = Database["public"]["Tables"]["Pocket"]["Row"];

export type PocketRecord = {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  note: string | null;
  monthlyBudget: number;
  goalAmount: number;
  order: number;
  isActive: boolean;
  balance: number;
  profileId: string;
  createdAt: Date;
  updatedAt: Date;
};

export function mapPocketRow(row: PocketRow): PocketRecord {
  return {
    id: row.id,
    name: row.name,
    icon: row.icon,
    color: row.color,
    note: row.note,
    monthlyBudget: row.monthlyBudget,
    goalAmount: row.goalAmount,
    order: row.order,
    isActive: row.isActive,
    balance: row.balance,
    profileId: row.profileId,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  };
}

export async function getPockets(profileId: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("Pocket")
    .select("*")
    .eq("profileId", profileId)
    .order("order", { ascending: true })
    .order("createdAt", { ascending: true });

  if (error) {
    throw new Error(`Gagal memuat pocket: ${error.message}`);
  }

  return (data ?? []).map(mapPocketRow);
}

export async function getTotalBalance(profileId: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("Pocket")
    .select("balance")
    .eq("profileId", profileId)
    .eq("isActive", true);

  if (error) {
    throw new Error(`Gagal menghitung saldo total: ${error.message}`);
  }

  return (data ?? []).reduce((sum, row) => sum + (row.balance ?? 0), 0);
}

export async function upsertPocket(input: PocketUpsertWithProfile) {
  const supabase = getSupabaseAdminClient();
  const nowIso = new Date().toISOString();

  if (input.id) {
    const { data: existing, error: lookupError } = await supabase
      .from("Pocket")
      .select("id, profileId")
      .eq("id", input.id)
      .maybeSingle();

    if (lookupError) {
      throw new Error(`Gagal memeriksa pocket: ${lookupError.message}`);
    }

    if (!existing || existing.profileId !== input.profileId) {
      throw new Error("Pocket tidak ditemukan pada profil ini.");
    }

    const { data, error } = await supabase
      .from("Pocket")
      .update({
        name: input.name,
        icon: input.icon ?? null,
        color: input.color ?? null,
        monthlyBudget: input.monthlyBudget ?? 0,
        goalAmount: input.goalAmount ?? 0,
        order: input.order ?? 0,
        isActive: input.isActive ?? true,
        updatedAt: nowIso,
      })
      .eq("id", input.id)
      .select()
      .single();

    if (error) {
      throw new Error(`Gagal memperbarui pocket: ${error.message}`);
    }

    return mapPocketRow(data);
  }

  const nextOrder =
    input.order ??
    ((await (async () => {
      const { data, error } = await supabase
        .from("Pocket")
        .select("order")
        .eq("profileId", input.profileId)
        .order("order", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error && error.code !== "PGRST116") {
        throw new Error(`Gagal mengambil urutan pocket: ${error.message}`);
      }
      return data?.order ?? 0;
    })()) ?? 0) + 1;

  const { data, error } = await supabase
    .from("Pocket")
    .insert({
      id: randomUUID(),
      name: input.name,
      icon: input.icon ?? null,
      color: input.color ?? null,
      monthlyBudget: input.monthlyBudget ?? 0,
      goalAmount: input.goalAmount ?? 0,
      order: nextOrder,
      isActive: input.isActive ?? true,
      balance: 0,
      profileId: input.profileId,
      createdAt: nowIso,
      updatedAt: nowIso,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Gagal membuat pocket: ${error.message}`);
  }

  return mapPocketRow(data);
}

export async function reorderPockets(
  profileId: string,
  order: Array<{ id: string; order: number }>,
) {
  if (!order.length) return [];

  const ids = order.map((item) => item.id);
  const supabase = getSupabaseAdminClient();

  const { data: pockets, error: fetchError } = await supabase
    .from("Pocket")
    .select("id, profileId")
    .in("id", ids);

  if (fetchError) {
    throw new Error(`Gagal memeriksa pocket: ${fetchError.message}`);
  }

  if ((pockets ?? []).some((pocket) => pocket.profileId !== profileId)) {
    throw new Error("Urutan pocket tidak valid untuk profil aktif.");
  }

  const nowIso = new Date().toISOString();
  const results: PocketRecord[] = [];
  for (const { id, order: newOrder } of order) {
    const { data, error } = await supabase
      .from("Pocket")
      .update({ order: newOrder, updatedAt: nowIso })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw new Error(`Gagal memperbarui urutan pocket: ${error.message}`);
    }

    results.push(mapPocketRow(data));
  }

  return results;
}

export async function adjustPocketBalance(id: string, delta: number, profileId: string) {
  const supabase = getSupabaseAdminClient();
  const { data: pocket, error: pocketError } = await supabase
    .from("Pocket")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (pocketError) {
    throw new Error(`Gagal memuat pocket: ${pocketError.message}`);
  }

  if (!pocket || pocket.profileId !== profileId) {
    throw new Error("Pocket tidak ditemukan pada profil aktif.");
  }

  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("Pocket")
    .update({
      balance: pocket.balance + delta,
      updatedAt: nowIso,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(`Gagal memperbarui saldo pocket: ${error.message}`);
  }

  return mapPocketRow(data);
}

export async function deletePocket(id: string, profileId: string) {
  const supabase = getSupabaseAdminClient();

  const { data: existing, error: lookupError } = await supabase
    .from("Pocket")
    .select("id, profileId")
    .eq("id", id)
    .maybeSingle();

  if (lookupError) {
    throw new Error(`Gagal memuat pocket: ${lookupError.message}`);
  }

  if (!existing || existing.profileId !== profileId) {
    throw new Error("Pocket tidak ditemukan pada profil aktif.");
  }

  const { data, error } = await supabase.from("Pocket").delete().eq("id", id).select().single();

  if (error) {
    throw new Error(`Gagal menghapus pocket: ${error.message}`);
  }

  return mapPocketRow(data);
}

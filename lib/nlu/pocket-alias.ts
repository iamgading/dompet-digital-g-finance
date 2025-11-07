"use server";

import { getSupabaseAdminClient } from "@/lib/supabase";

import { generatePocketAliasesFromName } from "./pocket-alias-utils";
import type { PocketAlias } from "./pocket-alias-utils";

export async function buildPocketAliases(): Promise<PocketAlias[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("Pocket")
    .select("id,name")
    .eq("isActive", true)
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`Gagal membangun alias pocket: ${error.message}`);
  }

  return (data ?? []).map((pocket) => ({
    id: pocket.id,
    name: pocket.name,
    aliases: generatePocketAliasesFromName(pocket.name),
  }));
}

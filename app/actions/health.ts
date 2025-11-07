"use server";

import { getSupabaseAdminClient } from "@/lib/supabase";

export interface DbHealthResult {
  ok: boolean;
  error?: string;
}

export async function dbHealth(): Promise<DbHealthResult> {
  try {
    const supabase = getSupabaseAdminClient();
    const { error } = await supabase.from("Profile").select("id").limit(1);
    if (error) {
      throw error;
    }
    return { ok: true };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown database error";
    console.error("Database health check failed", message);
    return { ok: false, error: message };
  }
}

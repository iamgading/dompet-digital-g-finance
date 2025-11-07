import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "./types";

type SupabaseDatabase = SupabaseClient<Database>;

const globalForSupabase = globalThis as unknown as {
  supabaseAdmin?: SupabaseDatabase;
};

function ensureEnv(name: string) {
  const value = process.env[name];
  if (!value || value.length === 0) {
    throw new Error(`${name} tidak ditemukan di environment. Pastikan sudah di-set sebelum memanggil Supabase client.`);
  }
  return value;
}

function createAdminClient(): SupabaseDatabase {
  const url = ensureEnv("SUPABASE_URL");
  const serviceRoleKey = ensureEnv("SUPABASE_SERVICE_ROLE_KEY");

  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        "X-Client-Info": "g-finance/server",
      },
    },
  });
}

export function getSupabaseAdminClient(): SupabaseDatabase {
  if (!globalForSupabase.supabaseAdmin) {
    globalForSupabase.supabaseAdmin = createAdminClient();
  }
  return globalForSupabase.supabaseAdmin;
}


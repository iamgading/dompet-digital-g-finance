import { notFound } from "next/navigation";

import { checkDbHealth } from "@/lib/health";
import { getSupabaseAdminClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

async function getCounts() {
  const supabase = getSupabaseAdminClient();

  const [pockets, transactions] = await Promise.all([
    supabase.from("Pocket").select("id", { count: "exact", head: true }),
    supabase.from("Transaction").select("id", { count: "exact", head: true }),
  ]);

  if (pockets.error) {
    throw new Error(`Gagal menghitung pocket: ${pockets.error.message}`);
  }

  if (transactions.error) {
    throw new Error(`Gagal menghitung transaksi: ${transactions.error.message}`);
  }

  return {
    pockets: pockets.count ?? 0,
    transactions: transactions.count ?? 0,
  };
}

export default async function DebugDbPage() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  const [health, counts] = await Promise.all([checkDbHealth(), getCounts()]);

  const supabaseUrl = process.env.SUPABASE_URL ?? "not-set";
  const maskedUrl = supabaseUrl.replace(/(https:\/\/.{6}).+/, "$1…");

  return (
    <main className="space-y-6 p-6">
      <h1 className="text-2xl font-semibold">Database Diagnostics</h1>

      <section className="space-y-2 rounded-md border border-gray-200 p-4">
        <h2 className="text-lg font-medium">Health</h2>
        <p className="text-sm">
          Status:{" "}
          <span className={health.ok ? "text-green-600" : "text-red-600"}>
            {health.ok ? "ok" : "unhealthy"}
          </span>
        </p>
        {!health.ok && health.error ? (
          <p className="text-sm text-red-600">Error: {health.error}</p>
        ) : null}
      </section>

      <section className="space-y-2 rounded-md border border-gray-200 p-4">
        <h2 className="text-lg font-medium">Supabase</h2>
        <p className="text-sm">
          URL: <code className="rounded bg-slate-100 px-1 py-0.5">{maskedUrl}</code>
        </p>
      </section>

      <section className="space-y-2 rounded-md border border-gray-200 p-4">
        <h2 className="text-lg font-medium">Data snapshot</h2>
        <p className="text-sm">Pockets: {counts.pockets}</p>
        <p className="text-sm">Transactions: {counts.transactions}</p>
      </section>
    </main>
  );
}

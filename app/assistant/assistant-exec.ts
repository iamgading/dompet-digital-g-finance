"use server";

import { randomUUID } from "node:crypto";

import { createTransaction, transferBetweenPockets, deleteTransaction } from "@/app/actions/finance";
import { getSupabaseAdminClient, type Database } from "@/lib/supabase";
import type { ExecutionPlan } from "@/lib/assistant/dialog-manager";

type ExecResult =
  | {
      success: true;
      undoToken: string;
      undoExpiresAt: string;
      details: unknown;
    }
  | {
      success: false;
      error: string;
    };

const UNDO_WINDOW_MS = 2 * 60 * 1000;

function createUndoToken() {
  return randomUUID();
}

async function logJournal(entry: {
  type: "income" | "expense" | "transfer";
  payload: unknown;
  affectedTxnIds: string[];
  undoToken: string;
}) {
  const supabase = getSupabaseAdminClient();
  const nowIso = new Date().toISOString();
  const { error } = await supabase.from("Journal").insert({
    id: randomUUID(),
    type: entry.type,
    payload: entry.payload as Database["public"]["Tables"]["Journal"]["Row"]["payload"],
    affectedTxnIds: entry.affectedTxnIds as Database["public"]["Tables"]["Journal"]["Row"]["affectedTxnIds"],
    undoToken: entry.undoToken,
    createdAt: nowIso,
  });

  if (error) {
    throw new Error(`Gagal mencatat jurnal: ${error.message}`);
  }
}

export async function execPlan(plan: ExecutionPlan): Promise<ExecResult> {
  const undoToken = createUndoToken();
  const undoExpiresAt = new Date(Date.now() + UNDO_WINDOW_MS).toISOString();

  if (plan.kind === "income") {
    const result = await createTransaction({
      type: "income",
      amount: plan.payload.amount,
      pocketId: plan.payload.pocketId,
      note: plan.payload.note ?? undefined,
    });
    if (!result.success) {
      return { success: false, error: result.error };
    }
    await logJournal({
      type: "income",
      payload: {
        amount: plan.payload.amount,
        pocketId: plan.payload.pocketId,
        note: plan.payload.note ?? null,
      },
      affectedTxnIds: [result.data.transaction.id],
      undoToken,
    });
    return {
      success: true,
      undoToken,
      undoExpiresAt,
      details: result.data,
    };
  }

  if (plan.kind === "expense") {
    const result = await createTransaction({
      type: "expense",
      amount: plan.payload.amount,
      pocketId: plan.payload.pocketId,
      note: plan.payload.note ?? undefined,
    });
    if (!result.success) {
      return { success: false, error: result.error };
    }
    await logJournal({
      type: "expense",
      payload: {
        amount: plan.payload.amount,
        pocketId: plan.payload.pocketId,
        note: plan.payload.note ?? null,
      },
      affectedTxnIds: [result.data.transaction.id],
      undoToken,
    });
    return {
      success: true,
      undoToken,
      undoExpiresAt,
      details: result.data,
    };
  }

  const result = await transferBetweenPockets({
    fromId: plan.payload.fromId,
    toId: plan.payload.toId,
    amount: plan.payload.amount,
    note: plan.payload.note ?? undefined,
  });

  if (!result.success) {
    return { success: false, error: result.error };
  }

  const transactions = result.data.transactions ?? [];
  await logJournal({
    type: "transfer",
    payload: {
      amount: plan.payload.amount,
      fromId: plan.payload.fromId,
      toId: plan.payload.toId,
      note: plan.payload.note ?? null,
    },
    affectedTxnIds: transactions.map((txn) => txn.id),
    undoToken,
  });

  return {
    success: true,
    undoToken,
    undoExpiresAt,
    details: result.data,
  };
}

export async function undoByToken(token: string) {
  const supabase = getSupabaseAdminClient();
  const { data: journal, error } = await supabase
    .from("Journal")
    .select("*")
    .eq("undoToken", token)
    .maybeSingle();

  if (error) {
    return { success: false as const, error: `Gagal memuat jurnal undo: ${error.message}` };
  }

  if (!journal) {
    return { success: false as const, error: "Token undo tidak ditemukan atau sudah digunakan." };
  }

  try {
    if (journal.type === "income" || journal.type === "expense") {
      const [transactionId] = (journal.affectedTxnIds as unknown as string[]) ?? [];
      if (!transactionId) {
        throw new Error("Transaksi tidak ditemukan untuk di-undo.");
      }
      const deletion = await deleteTransaction(transactionId);
      if (!deletion.success) {
        throw new Error(deletion.error);
      }
    } else if (journal.type === "transfer") {
      const payload = journal.payload as unknown as {
        amount: number;
        fromId: string;
        toId: string;
        note?: string | null;
      };
      const reverse = await transferBetweenPockets({
        fromId: payload.toId,
        toId: payload.fromId,
        amount: payload.amount,
        note: payload.note ? `Undo: ${payload.note}` : "Undo transfer",
      });
      if (!reverse.success) {
        throw new Error(reverse.error);
      }
    }

    const { error: deleteError } = await supabase.from("Journal").delete().eq("undoToken", token);
    if (deleteError) {
      throw new Error(`Gagal menghapus jurnal: ${deleteError.message}`);
    }

    return { success: true as const };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Gagal melakukan undo.",
    };
  }
}

"use server";

import { revalidatePath, revalidateTag } from "next/cache";

import {
  ZPocketUpsert,
  ZTransactionFilter,
  ZTransfer,
  ZTxnCreate,
  ZPocketReorder,
  ZImportTransactionsInput,
  type ImportTransactionsInput,
  type PocketUpsertInput,
  type TransactionFilterInput,
  type TransferInput,
  type PocketReorderInput,
  type TxnCreateInput,
} from "@/lib/validators";
import { getActiveProfileId } from "@/app/actions/profile";
import {
  adjustPocketBalance as repoAdjustPocketBalance,
  getPockets as repoGetPockets,
  reorderPockets as repoReorderPockets,
  upsertPocket as repoUpsertPocket,
  deletePocket as repoDeletePocket,
} from "@/lib/repo/pockets";
import {
  createTransaction as repoCreateTransaction,
  deleteTransactionById,
  listTransactions as repoListTransactions,
  transferBetweenPockets as repoTransferBetweenPockets,
  importTransactions as repoImportTransactions,
  type ImportRow,
} from "@/lib/repo/transactions";
import { getCachedPockets, getCachedTotalBalance } from "@/lib/cache/data";
import { CACHE_TAGS } from "@/lib/cache/tags";

type ActionSuccess<T> = { success: true; data: T };
type ActionFailure = { success: false; error: string };

function success<T>(data: T): ActionSuccess<T> {
  return { success: true, data };
}

function failure(error: unknown): ActionFailure {
  const message =
    error instanceof Error ? error.message : "Terjadi kesalahan yang tidak diketahui.";
  console.error("[actions]", error);
  return { success: false, error: message };
}

export async function getTotalBalance() {
  try {
    const profileId = await getActiveProfileId();
    const total = await getCachedTotalBalance(profileId);
    return success({ total });
  } catch (error) {
    return failure(error);
  }
}

export async function listPockets() {
  try {
    const profileId = await getActiveProfileId();
    const pockets = await getCachedPockets(profileId);
    return success(pockets);
  } catch (error) {
    return failure(error);
  }
}

export async function upsertPocket(input: PocketUpsertInput) {
  try {
    const payload = ZPocketUpsert.parse(input);
    const profileId = await getActiveProfileId();
    const pocket = await repoUpsertPocket({ ...payload, profileId });
    await repoReorderPockets(
      profileId,
      (await repoGetPockets(profileId)).map(({ id }, index) => ({ id, order: index + 1 })),
    );
    revalidateTag(CACHE_TAGS.pockets);
    revalidateTag(CACHE_TAGS.totalBalance);
    await revalidatePath("/");
    return success(pocket);
  } catch (error) {
    return failure(error);
  }
}

export async function createTransaction(input: TxnCreateInput) {
  try {
    const payload = ZTxnCreate.parse(input);
    const profileId = await getActiveProfileId();
    const result = await repoCreateTransaction(payload, profileId);
    revalidateTag(CACHE_TAGS.totalBalance);
    revalidateTag(CACHE_TAGS.pockets);
    revalidateTag(CACHE_TAGS.cashflow);
    revalidateTag(CACHE_TAGS.transactions);
    await revalidatePath("/");
    return success(result);
  } catch (error) {
    return failure(error);
  }
}

export async function transferBetweenPockets(input: TransferInput) {
  try {
    const payload = ZTransfer.parse(input);
    const profileId = await getActiveProfileId();
    const result = await repoTransferBetweenPockets(payload, profileId);
    revalidateTag(CACHE_TAGS.totalBalance);
    revalidateTag(CACHE_TAGS.pockets);
    revalidateTag(CACHE_TAGS.cashflow);
    revalidateTag(CACHE_TAGS.transactions);
    await revalidatePath("/");
    return success(result);
  } catch (error) {
    return failure(error);
  }
}

export async function reorderPockets(input: PocketReorderInput) {
  try {
    const payload = ZPocketReorder.parse(input);
    const updates = payload.idsInNewOrder.map((id, index) => ({
      id,
      order: index + 1,
    }));
    const profileId = await getActiveProfileId();
    const pockets = await repoReorderPockets(profileId, updates);
    revalidateTag(CACHE_TAGS.pockets);
    await revalidatePath("/");
    return success(pockets);
  } catch (error) {
    return failure(error);
  }
}

export async function importTransactions(input: ImportTransactionsInput) {
  try {
    const payload = ZImportTransactionsInput.parse(input);
    const invalid: Array<{ description: string; reason: string }> = [];

    const sanitized: ImportRow[] = payload.rows
      .map<ImportRow | null>((row) => {
        const resolvedPocketId = row.pocketId ?? payload.defaultPocketId;
        if (!resolvedPocketId) {
          invalid.push({ description: row.description, reason: "Pocket tidak ditentukan." });
          return null;
        }

        const parsedDate = new Date(row.date);
        if (Number.isNaN(parsedDate.getTime())) {
          invalid.push({ description: row.description, reason: "Tanggal tidak valid." });
          return null;
        }

        let amountValue = row.amount;
        if (!Number.isFinite(amountValue) || amountValue === 0) {
          invalid.push({ description: row.description, reason: "Nominal tidak valid." });
          return null;
        }

        if (payload.reverseSign) {
          amountValue = -amountValue;
        }

        const type: ImportRow["type"] = amountValue >= 0 ? "income" : "expense";

        return {
          description: row.description,
          note: row.note,
          pocketId: resolvedPocketId,
          externalRef: row.externalRef,
          date: parsedDate,
          type,
          amount: amountValue,
        };
      })
      .filter((row): row is ImportRow => Boolean(row));

    const profileId = await getActiveProfileId();
    const result = await repoImportTransactions(sanitized, profileId);
    if (invalid.length > 0) {
      result.failures.push(...invalid.map((item) => ({ description: item.description, reason: item.reason })));
    }
    revalidateTag(CACHE_TAGS.totalBalance);
    revalidateTag(CACHE_TAGS.pockets);
    revalidateTag(CACHE_TAGS.cashflow);
    revalidateTag(CACHE_TAGS.transactions);
    await revalidatePath("/");
    return success({
      ...result,
      totalRows: payload.rows.length,
    });
  } catch (error) {
    return failure(error);
  }
}

export async function deleteTransaction(id: string) {
  try {
    if (!id || id.trim().length === 0) {
      throw new Error("ID transaksi wajib diisi.");
    }

    const profileId = await getActiveProfileId();
    const result = await deleteTransactionById(id.trim(), profileId);
    revalidateTag(CACHE_TAGS.totalBalance);
    revalidateTag(CACHE_TAGS.pockets);
    revalidateTag(CACHE_TAGS.cashflow);
    revalidateTag(CACHE_TAGS.transactions);
    await revalidatePath("/");
    return success(result);
  } catch (error) {
    return failure(error);
  }
}

export async function listTransactions(filter: Partial<TransactionFilterInput> = {}) {
  try {
    const payload = ZTransactionFilter.parse(filter ?? {});
    const profileId = await getActiveProfileId();
    const transactions = await repoListTransactions(
      {
        pocketId: payload.pocketId,
        type: payload.type,
        limit: payload.limit ?? 20,
        order: payload.order ?? "desc",
      },
      profileId,
    );
    return success(transactions);
  } catch (error) {
    return failure(error);
  }
}

export async function adjustPocketBalance(id: string, delta: number) {
  try {
    const profileId = await getActiveProfileId();
    const updated = await repoAdjustPocketBalance(id, delta, profileId);
    revalidateTag(CACHE_TAGS.totalBalance);
    revalidateTag(CACHE_TAGS.pockets);
    await revalidatePath("/");
    return success(updated);
  } catch (error) {
    return failure(error);
  }
}

export async function deletePocket(id: string) {
  try {
    const profileId = await getActiveProfileId();
    const deleted = await repoDeletePocket(id, profileId);
    revalidateTag(CACHE_TAGS.pockets);
    revalidateTag(CACHE_TAGS.totalBalance);
    revalidateTag(CACHE_TAGS.cashflow);
    revalidateTag(CACHE_TAGS.transactions);
    await revalidatePath("/");
    return success(deleted);
  } catch (error) {
    return failure(error);
  }
}

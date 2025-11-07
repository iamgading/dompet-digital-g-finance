"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";

import { createTransaction } from "@/app/actions/finance";
import { useSyncQueue } from "@/hooks/use-sync-queue";
import { enqueueOfflineTransaction, createClientRef, type QueuedTxnPayload } from "@/lib/offline-queue";
import { cn } from "@/lib/utils";
import { ZTxnCreate, type TxnCreateInput } from "@/lib/validators";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/hooks/use-i18n";

type PocketOption = {
  id: string;
  name: string;
};

type QuickAddVariant = "dialog" | "inline";

interface QuickAddTransactionDialogProps {
  pockets: PocketOption[];
  onOptimisticCreate?: (input: TxnCreateInput) => void;
  onSettled?: (result: Awaited<ReturnType<typeof createTransaction>>, payload: TxnCreateInput) => void;
  onQueued?: (payload: QueuedTxnPayload) => void;
  variant?: QuickAddVariant;
  triggerLabel?: string;
  autoOpen?: boolean;
  hideTrigger?: boolean;
  defaultType?: TxnCreateInput["type"];
  defaultPocketId?: string;
  onOpenChange?: (open: boolean) => void;
}

export function QuickAddTransactionDialog({
  pockets,
  onOptimisticCreate,
  onSettled,
  onQueued,
  variant = "dialog",
  triggerLabel = "+ Transaksi",
  autoOpen = false,
  hideTrigger = false,
  defaultType,
  defaultPocketId,
  onOpenChange,
}: QuickAddTransactionDialogProps) {
  const { online } = useSyncQueue();
  const { t } = useI18n();
  const computedTriggerLabel = triggerLabel ?? t("transactions.quickAdd", "+ Transaksi");

  const isInline = variant === "inline";
  const [open, setOpen] = useState(isInline);
  const [type, setType] = useState<TxnCreateInput["type"]>("income");
  const [amount, setAmount] = useState<string>("");
  const [pocketId, setPocketId] = useState<string>(pockets[0]?.id ?? "");
  const [note, setNote] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [queuedMessage, setQueuedMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (pockets.length === 0) {
      setPocketId("");
      return;
    }
    if (!pockets.some((pocket) => pocket.id === pocketId)) {
      setPocketId(pockets[0].id);
    }
  }, [pocketId, pockets]);

  useEffect(() => {
    if (!isInline && autoOpen) {
      if (defaultType) {
        setType(defaultType);
      }
      if (defaultPocketId && pockets.some((pocket) => pocket.id === defaultPocketId)) {
        setPocketId(defaultPocketId);
      } else if (pockets[0]) {
        setPocketId(pockets[0].id);
      }
      setOpen(true);
      onOpenChange?.(true);
    }
  }, [autoOpen, defaultType, defaultPocketId, isInline, onOpenChange, pockets]);

  useEffect(() => {
    if (!queuedMessage) return;
    const timeout = setTimeout(() => setQueuedMessage(null), 4000);
    return () => clearTimeout(timeout);
  }, [queuedMessage]);

  const parsedAmount = useMemo(() => Number.parseInt(amount || "0", 10), [amount]);

  const resetForm = () => {
    setType("income");
    setAmount("");
    setNote("");
    setError(null);
  };

  const closeIfDialog = () => {
    if (!isInline) {
      setOpen(false);
    }
  };

  const handleOfflineQueue = async (payload: TxnCreateInput, message: string) => {
    const queued = await enqueueOfflineTransaction(payload);
    setQueuedMessage(message);
    resetForm();
    closeIfDialog();
    onQueued?.(queued);
  };

  const handleSubmit = async () => {
    const formData: TxnCreateInput = {
      type,
      amount: Number.isFinite(parsedAmount) ? parsedAmount : 0,
      pocketId,
      note: note.trim() ? note.trim() : undefined,
    };

    const validation = ZTxnCreate.safeParse(formData);
    if (!validation.success) {
      setError(validation.error.issues[0]?.message ?? "Data tidak valid");
      return;
    }

    const payload: TxnCreateInput = {
      ...validation.data,
      clientRef: validation.data.clientRef ?? createClientRef(),
    };

    if (!online) {
      setError(null);
      await handleOfflineQueue(payload, "Offline – transaksi disimpan sementara.");
      return;
    }

    setError(null);
    onOptimisticCreate?.(payload);
    startTransition(async () => {
      try {
        const result = await createTransaction(payload);
        onSettled?.(result, payload);
        if (result.success) {
          resetForm();
          closeIfDialog();
        } else {
          setError(result.error);
        }
      } catch (error) {
        console.error("[quick-add]", error);
        const fallback: Awaited<ReturnType<typeof createTransaction>> = {
          success: false,
          error: "Koneksi terputus. Transaksi disimpan sementara.",
        };
        onSettled?.(fallback, payload);
        await handleOfflineQueue(payload, "Koneksi terputus – transaksi disimpan sementara.");
      }
    });
  };

  const formFields = (
    <div className="grid gap-4">
      {queuedMessage ? (
        <p className="rounded-2xl border border-amber-400/50 bg-amber-100/80 px-3 py-2 text-xs font-medium text-amber-800 dark:border-amber-300/40 dark:bg-amber-500/10 dark:text-amber-200">
          {queuedMessage}
        </p>
      ) : null}

      <label className="grid gap-2 text-sm">
        <span className="text-slate-600 dark:text-slate-200">{t("transactions.amountLabel", "Nominal")}</span>
        <Input
          autoFocus
          inputMode="numeric"
          pattern="[0-9]*"
          placeholder="0"
          value={amount}
          onChange={(event) => {
            const raw = event.target.value.replace(/[^0-9]/g, "");
            setAmount(raw);
          }}
          className="h-12 rounded-2xl border-slate-200 bg-white/60 text-lg tabular-nums focus-visible:ring-cyan-500 dark:border-slate-700 dark:bg-slate-900"
        />
      </label>

      <fieldset className="grid gap-2">
        <legend className="text-sm text-slate-600 dark:text-slate-200">{t("transactions.typeLabel", "Jenis")}</legend>
        <div className="flex gap-2">
          {(["income", "expense"] as const).map((entry) => (
            <button
              key={entry}
              type="button"
              onClick={() => setType(entry)}
              className={cn(
                "h-10 flex-1 rounded-full border border-slate-200/70 bg-white/50 text-sm font-medium capitalize text-slate-600 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200",
                type === entry &&
                  "border-cyan-400 bg-cyan-500/10 text-cyan-600 dark:border-cyan-500/60 dark:text-cyan-300",
              )}
            >
              {entry === "income" ? t("transactions.income", "Pemasukan") : t("transactions.expense", "Pengeluaran")}
            </button>
          ))}
        </div>
      </fieldset>

      <label className="grid gap-2 text-sm">
        <span className="text-slate-600 dark:text-slate-200">{t("transactions.pocketLabel", "Pocket")}</span>
        <select
          value={pocketId}
          onChange={(event) => setPocketId(event.target.value)}
          className="h-11 rounded-2xl border border-slate-200 bg-white/60 px-4 text-sm text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
        >
          {pockets.map((pocketOption) => (
            <option key={pocketOption.id} value={pocketOption.id}>
              {pocketOption.name}
            </option>
          ))}
        </select>
      </label>

      <label className="grid gap-2 text-sm">
        <span className="text-slate-600 dark:text-slate-200">{t("transactions.noteLabel", "Catatan")}</span>
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder={t("transactions.notePlaceholder", "(Opsional)")}
          rows={3}
          className="resize-none rounded-2xl border border-slate-200 bg-white/60 px-4 py-3 text-sm text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
        />
      </label>

      {error ? <p className="text-sm text-red-500">{error}</p> : null}
    </div>
  );

  const handleFormSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void handleSubmit();
  };

  if (isInline) {
    return (
      <section className="rounded-3xl border border-slate-200/60 bg-white/80 p-6 shadow-lg backdrop-blur dark:border-slate-700/40 dark:bg-slate-900/80">
        <header className="mb-4">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">{t("transactions.inlineTitle", "Quick Add")}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-300">
            {t("transactions.inlineSubtitle", "Tambah transaksi ringan kapan saja, bahkan saat offline.")}
          </p>
        </header>
        <form className="grid gap-6" onSubmit={handleFormSubmit}>
          {formFields}
          <div className="flex items-center justify-end gap-3">
          <Button type="button" variant="outline" onClick={resetForm} disabled={isPending}>
            {t("transactions.reset", "Reset")}
          </Button>
          <Button type="submit" disabled={isPending} className="gap-2">
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            {t("transactions.save", "Simpan")}
          </Button>
          </div>
        </form>
      </section>
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (isPending) return;
        setOpen(next);
        onOpenChange?.(next);
        if (!next && !isInline) {
          setTimeout(() => {
            setType("income");
          }, 0);
        }
      }}
    >
      {hideTrigger ? null : (
        <DialogTrigger asChild>
          <Button className="group h-11 justify-start rounded-2xl border border-transparent bg-gradient-to-r from-cyan-500/90 to-blue-500/90 text-sm font-semibold text-white shadow-sm transition duration-200 ease-out hover:from-cyan-500 hover:to-blue-500 hover:shadow-lg hover:-translate-y-0.5 focus-visible:ring-offset-2 dark:from-cyan-500/80 dark:to-sky-500/80">
            {computedTriggerLabel}
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="w-full max-w-md rounded-3xl border border-slate-200/50 bg-white/80 p-6 backdrop-blur dark:border-slate-700/40 dark:bg-slate-900/80">
        <DialogHeader>
          <DialogTitle>{t("transactions.dialogTitle", "Tambah Transaksi")}</DialogTitle>
        </DialogHeader>

        <form className="mt-4 grid gap-6" onSubmit={handleFormSubmit}>
          {formFields}
          <DialogFooter className="flex items-center justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={isPending}>
              {t("transactions.cancel", "Batal")}
            </Button>
            <Button type="submit" disabled={isPending} className="gap-2">
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
              {t("transactions.save", "Simpan")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export type { QueuedTxnPayload as QuickAddQueuedPayload };

"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

import { transferBetweenPockets } from "@/app/actions/finance";
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
import { ZTransfer, type TransferInput } from "@/lib/validators";
import { Loader2 } from "lucide-react";

type PocketOption = {
  id: string;
  name: string;
};

type OptimisticTransferInput = Pick<TransferInput, "fromId" | "toId" | "amount"> & {
  note?: string;
};

export type TransferOptimisticPayload = OptimisticTransferInput;
export type TransferActionResult = Awaited<ReturnType<typeof transferBetweenPockets>>;

interface TransferDialogProps {
  pockets: PocketOption[];
  onOptimisticTransfer: (input: OptimisticTransferInput) => void;
  onSettled: (
    result: Awaited<ReturnType<typeof transferBetweenPockets>>,
    context: OptimisticTransferInput,
  ) => void;
  onFeedback?: (feedback: { type: "success" | "error"; message: string }) => void;
  autoOpen?: boolean;
  defaultFromId?: string;
  defaultToId?: string;
  onOpenChange?: (open: boolean) => void;
}

export function TransferDialog({
  pockets,
  onOptimisticTransfer,
  onSettled,
  onFeedback,
  autoOpen = false,
  defaultFromId,
  defaultToId,
  onOpenChange,
}: TransferDialogProps) {
  const [open, setOpen] = useState(false);
  const [fromId, setFromId] = useState<string>(pockets[0]?.id ?? "");
  const [toId, setToId] = useState<string>(pockets[1]?.id ?? pockets[0]?.id ?? "");
  const [amount, setAmount] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const hasEnoughPockets = pockets.length >= 2;

  useEffect(() => {
    if (pockets.length === 0) {
      setFromId("");
      setToId("");
      return;
    }

    if (!pockets.some((pocket) => pocket.id === fromId)) {
      setFromId(pockets[0].id);
    }

    if (!pockets.some((pocket) => pocket.id === toId) || fromId === toId) {
      const fallback = pockets.find((pocket) => pocket.id !== fromId);
      setToId(fallback?.id ?? pockets[0].id);
    }
  }, [fromId, pockets, toId]);

  useEffect(() => {
    if (!autoOpen) return;
    if (defaultFromId && pockets.some((pocket) => pocket.id === defaultFromId)) {
      setFromId(defaultFromId);
    }
    if (defaultToId && pockets.some((pocket) => pocket.id === defaultToId)) {
      setToId(defaultToId === defaultFromId ? pockets.find((pocket) => pocket.id !== defaultFromId)?.id ?? defaultToId : defaultToId);
    }
    setOpen(true);
    onOpenChange?.(true);
  }, [autoOpen, defaultFromId, defaultToId, onOpenChange, pockets]);

  const parsedAmount = useMemo(() => Number.parseInt(amount || "0", 10), [amount]);

  const resetForm = () => {
    setAmount("");
    setNote("");
    setError(null);
  };

  const handleSubmit = () => {
    const trimmedNote = note.trim();
    const payload: TransferInput = {
      fromId,
      toId,
      amount: Number.isFinite(parsedAmount) ? parsedAmount : 0,
      note: trimmedNote ? trimmedNote : undefined,
    };

    const validation = ZTransfer.safeParse(payload);
    if (!validation.success) {
      setError(validation.error.issues[0]?.message ?? "Data transfer tidak valid.");
      return;
    }

    setError(null);
    const optimisticPayload: OptimisticTransferInput = {
      fromId: validation.data.fromId,
      toId: validation.data.toId,
      amount: validation.data.amount,
      note: validation.data.note,
    };

    onOptimisticTransfer(optimisticPayload);
    startTransition(async () => {
      const result = await transferBetweenPockets(validation.data);
      if (!result.success) {
        setError(result.error);
        onFeedback?.({
          type: "error",
          message: result.error,
        });
      } else {
        resetForm();
        setOpen(false);
        onFeedback?.({
          type: "success",
          message: "Transfer antar pocket berhasil.",
        });
      }
      onSettled(result, optimisticPayload);
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (isPending) return;
        setOpen(next);
        onOpenChange?.(next);
        if (!next) {
          resetForm();
        }
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant="secondary"
          className="group h-11 rounded-2xl border border-transparent bg-gradient-to-r from-violet-500/90 to-sky-500/90 text-sm font-semibold text-white shadow-sm transition duration-200 ease-out hover:from-violet-500 hover:to-sky-500 hover:shadow-lg hover:-translate-y-0.5 disabled:opacity-50 dark:from-violet-500/80 dark:to-sky-500/80"
          type="button"
          disabled={!hasEnoughPockets}
        >
          Transfer Pocket
        </Button>
      </DialogTrigger>
      <DialogContent className="w-full max-w-md rounded-3xl border border-slate-200/50 bg-white/80 p-6 backdrop-blur dark:border-slate-700/40 dark:bg-slate-900/80">
        <DialogHeader>
          <DialogTitle>Transfer Antar Pocket</DialogTitle>
        </DialogHeader>

        <form
          className="mt-4 grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!isPending) handleSubmit();
          }}
        >
          <label className="grid gap-2 text-sm">
            <span className="text-slate-600 dark:text-slate-200">Dari Pocket</span>
            <select
              value={fromId}
              onChange={(event) => setFromId(event.target.value)}
              className="h-11 rounded-2xl border border-slate-200 bg-white/60 px-4 text-sm text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              {pockets.map((pocket) => (
                <option key={pocket.id} value={pocket.id}>
                  {pocket.name}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-2 text-sm">
            <span className="text-slate-600 dark:text-slate-200">Ke Pocket</span>
            <select
              value={toId}
              onChange={(event) => setToId(event.target.value)}
              className="h-11 rounded-2xl border border-slate-200 bg-white/60 px-4 text-sm text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              {pockets.map((pocket) => (
                <option key={pocket.id} value={pocket.id} disabled={pocket.id === fromId}>
                  {pocket.name}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-2 text-sm">
            <span className="text-slate-600 dark:text-slate-200">Nominal</span>
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

          <label className="grid gap-2 text-sm">
            <span className="text-slate-600 dark:text-slate-200">Catatan</span>
            <textarea
              rows={3}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="(Opsional)"
              className="resize-none rounded-2xl border border-slate-200 bg-white/60 px-4 py-3 text-sm text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            />
          </label>

          {error ? <p className="text-sm text-red-500">{error}</p> : null}

          <DialogFooter className="mt-6 flex items-center justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={isPending}>
              Batal
            </Button>
            <Button type="submit" className="gap-2" disabled={isPending}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
              Transfer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

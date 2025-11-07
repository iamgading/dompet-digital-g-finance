"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Loader2, Play, Trash2 } from "lucide-react";

import {
  createOrUpdateRecurring,
  deleteRecurring,
  runRecurringNow,
} from "@/app/actions/recurring";
import type { RecurringScheduleInput } from "@/lib/validators";
import { cn } from "@/lib/utils";
import { useUserPref } from "@/components/providers/user-pref-provider";
import { Button } from "@/components/ui/button";

type PocketOption = {
  id: string;
  name: string;
  color: string | null;
};

type RecurringItem = {
  id: string;
  name: string;
  type: "income" | "expense";
  amount: number;
  pocketId: string;
  pocketName: string;
  schedule: RecurringScheduleInput;
  autoPost: boolean;
  nextRunAt: string;
};

interface RecurringManagerProps {
  pockets: PocketOption[];
  initialItems: RecurringItem[];
}

type ScheduleMode = RecurringScheduleInput["mode"];

const WEEKDAY_LABELS = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

export function RecurringManager({ pockets, initialItems }: RecurringManagerProps) {
  const { formatCurrency } = useUserPref();
  const [items, setItems] = useState(initialItems);
  const [name, setName] = useState("");
  const [type, setType] = useState<"income" | "expense">("income");
  const [amount, setAmount] = useState("");
  const [pocketId, setPocketId] = useState<string>(pockets[0]?.id ?? "");
  const [mode, setMode] = useState<ScheduleMode>("monthly");
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [time, setTime] = useState("07:00");
  const [autoPost, setAutoPost] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  useEffect(() => {
    if (pockets.length === 0) {
      setPocketId("");
      return;
    }
    if (!pockets.some((pocket) => pocket.id === pocketId)) {
      setPocketId(pockets[0].id);
    }
  }, [pocketId, pockets]);

  const timeParts = useMemo(() => {
    const [h = "07", m = "00"] = time.split(":");
    return {
      hour: Number.parseInt(h, 10),
      minute: Number.parseInt(m, 10),
    };
  }, [time]);

  const resetForm = () => {
    setEditingId(null);
    setName("");
    setType("income");
    setAmount("");
    setPocketId(pockets[0]?.id ?? "");
    setMode("monthly");
    setDayOfWeek(1);
    setDayOfMonth(1);
    setTime("07:00");
    setAutoPost(true);
    setError(null);
  };

  const handleSubmit = () => {
    const parsedAmount = Number.parseInt(amount || "0", 10);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError("Nominal harus lebih besar dari 0.");
      return;
    }
    if (!pocketId) {
      setError("Pilih pocket tujuan.");
      return;
    }

    setError(null);

    const schedule: RecurringScheduleInput =
      mode === "weekly"
        ? {
            mode: "weekly",
            dayOfWeek,
            hour: timeParts.hour,
            minute: timeParts.minute,
          }
        : {
            mode: "monthly",
            dayOfMonth,
            hour: timeParts.hour,
            minute: timeParts.minute,
          };

    startTransition(async () => {
      const result = await createOrUpdateRecurring({
        id: editingId ?? undefined,
        name: name.trim(),
        type,
        amount: parsedAmount,
        pocketId,
        schedule,
        autoPost,
      });

      if (!result.success) {
        setError(result.error);
        return;
      }

      const updated = result.data;
      const nextItem: RecurringItem = {
        id: updated.id,
        name: updated.name,
        type: updated.type as "income" | "expense",
        amount: updated.amount,
        pocketId: updated.pocketId,
        pocketName: pockets.find((p) => p.id === updated.pocketId)?.name ?? "Pocket",
        schedule,
        autoPost: updated.autoPost,
        nextRunAt: new Date(updated.nextRunAt).toISOString(),
      };

      setItems((prev) => {
        const exists = prev.some((item) => item.id === nextItem.id);
        if (exists) {
          return prev.map((item) => (item.id === nextItem.id ? nextItem : item));
        }
        return [...prev, nextItem].sort((a, b) => new Date(a.nextRunAt).getTime() - new Date(b.nextRunAt).getTime());
      });
      setActionMessage(editingId ? "Recurring diperbarui." : "Recurring ditambahkan.");
      resetForm();
    });
  };

  const handleEdit = (id: string) => {
    const entry = items.find((item) => item.id === id);
    if (!entry) return;
    setEditingId(entry.id);
    setName(entry.name);
    setType(entry.type);
    setAmount(String(entry.amount));
    setPocketId(entry.pocketId);
    setMode(entry.schedule.mode);
    if (entry.schedule.mode === "weekly") {
      setDayOfWeek(entry.schedule.dayOfWeek);
    } else {
      setDayOfMonth(entry.schedule.dayOfMonth);
    }
    setTime(pad(entry.schedule.hour ?? 7) + ":" + pad(entry.schedule.minute ?? 0));
    setAutoPost(entry.autoPost);
  };

  const handleDelete = (id: string) => {
    startTransition(async () => {
      const result = await deleteRecurring({ id });
      if (!result.success) {
        setActionMessage(result.error);
        return;
      }
      setItems((prev) => prev.filter((item) => item.id !== id));
      setActionMessage("Recurring dihapus.");
      if (editingId === id) {
        resetForm();
      }
    });
  };

  const handleRunNow = (id: string) => {
    startTransition(async () => {
      const result = await runRecurringNow({ id });
      if (!result.success) {
        setActionMessage(result.error);
        return;
      }
      setItems((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                nextRunAt: new Date(result.data.recurring.nextRunAt).toISOString(),
              }
            : item,
        ),
      );
      setActionMessage("Recurring berhasil dijalankan.");
    });
  };

  const handleToggleAutoPost = (id: string, value: boolean) => {
    const entry = items.find((item) => item.id === id);
    if (!entry) return;
    startTransition(async () => {
      const result = await createOrUpdateRecurring({
        id,
        name: entry.name,
        type: entry.type,
        amount: entry.amount,
        pocketId: entry.pocketId,
        schedule: entry.schedule,
        autoPost: value,
      });
      if (!result.success) {
        setActionMessage(result.error);
        return;
      }
      setItems((prev) =>
        prev.map((item) =>
          item.id === id
            ? { ...item, autoPost: value, nextRunAt: new Date(result.data.nextRunAt).toISOString() }
            : item,
        ),
      );
      setActionMessage(value ? "Auto post diaktifkan." : "Auto post dimatikan.");
    });
  };

  return (
    <div className="grid gap-10">
      <section className="rounded-3xl border border-white/40 bg-white/70 p-6 shadow-lg backdrop-blur dark:border-white/10 dark:bg-white/10">
        <h2 className="text-xl font-semibold text-slate-800 dark:text-white">
          {editingId ? "Edit Recurring" : "Tambah Recurring"}
        </h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 text-sm text-slate-600 dark:text-slate-200">
            Nama
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            />
          </label>
          <label className="grid gap-2 text-sm text-slate-600 dark:text-slate-200">
            Nominal
            <input
              type="number"
              min={1}
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            />
          </label>
          <label className="grid gap-2 text-sm text-slate-600 dark:text-slate-200">
            Jenis
            <select
              value={type}
              onChange={(event) => setType(event.target.value as "income" | "expense")}
              className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              <option value="income">Pemasukan</option>
              <option value="expense">Pengeluaran</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm text-slate-600 dark:text-slate-200">
            Pocket Tujuan
            <select
              value={pocketId}
              onChange={(event) => setPocketId(event.target.value)}
              className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              <option value="">Pilih pocket...</option>
              {pockets.map((pocket) => (
                <option key={pocket.id} value={pocket.id}>
                  {pocket.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm text-slate-600 dark:text-slate-200">
            Frekuensi
            <select
              value={mode}
              onChange={(event) => setMode(event.target.value as ScheduleMode)}
              className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              <option value="weekly">Mingguan</option>
              <option value="monthly">Bulanan</option>
            </select>
          </label>

          {mode === "weekly" ? (
            <label className="grid gap-2 text-sm text-slate-600 dark:text-slate-200">
              Hari
              <select
                value={dayOfWeek}
                onChange={(event) => setDayOfWeek(Number.parseInt(event.target.value, 10))}
                className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              >
                {WEEKDAY_LABELS.map((label, index) => (
                  <option key={label} value={index}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label className="grid gap-2 text-sm text-slate-600 dark:text-slate-200">
              Tanggal
              <input
                type="number"
                min={1}
                max={31}
                value={dayOfMonth}
                onChange={(event) => setDayOfMonth(Number.parseInt(event.target.value, 10))}
                className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              />
            </label>
          )}

          <label className="grid gap-2 text-sm text-slate-600 dark:text-slate-200">
            Jam eksekusi
            <input
              type="time"
              value={time}
              onChange={(event) => setTime(event.target.value)}
              className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-200">
            <input
              type="checkbox"
              checked={autoPost}
              onChange={(event) => setAutoPost(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
            />
            Auto-post (jalan otomatis saat due)
          </label>
        </div>

        {error ? <p className="mt-4 text-sm text-rose-500">{error}</p> : null}

        <div className="mt-6 flex items-center gap-3">
          <Button type="button" onClick={handleSubmit} disabled={isPending}>
            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {editingId ? "Simpan Perubahan" : "Tambah Recurring"}
          </Button>
          {editingId ? (
            <Button type="button" variant="outline" onClick={resetForm}>
              Batalkan edit
            </Button>
          ) : null}
        </div>
      </section>

      <section className="rounded-3xl border border-white/40 bg-white/70 p-6 shadow-lg backdrop-blur dark:border-white/10 dark:bg-white/10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-800 dark:text-white">Daftar Recurring</h2>
            <p className="text-sm text-slate-500 dark:text-slate-300">Kelola jadwal gaji, saku, dan langganan.</p>
          </div>
          {actionMessage ? <span className="text-sm text-cyan-600 dark:text-cyan-300">{actionMessage}</span> : null}
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-white/30 bg-white/60 dark:border-white/10 dark:bg-white/5">
          <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-700/60">
            <thead className="bg-slate-50/80 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900/40 dark:text-slate-300">
              <tr>
                <th className="px-4 py-3">Nama</th>
                <th className="px-4 py-3 text-right">Nominal</th>
                <th className="px-4 py-3">Pocket</th>
                <th className="px-4 py-3">Jadwal</th>
                <th className="px-4 py-3">Next run</th>
                <th className="px-4 py-3">Auto</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70 dark:divide-slate-700/50">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-sm text-slate-500 dark:text-slate-300">
                    Belum ada recurring.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <span className="font-medium text-slate-800 dark:text-slate-100">{item.name}</span>
                        <button
                          type="button"
                          onClick={() => handleEdit(item.id)}
                          className="w-fit text-xs text-cyan-600 hover:underline dark:text-cyan-300"
                        >
                          Edit
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums">
                      <span className={item.type === "income" ? "text-emerald-600" : "text-rose-500"}>
                        {formatCurrency(item.amount)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-200">{item.pocketName}</td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-300">
                      {renderScheduleText(item.schedule)}
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-300">
                      {new Date(item.nextRunAt).toLocaleString("id-ID", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <label className="inline-flex items-center gap-2 text-xs text-slate-500 dark:text-slate-300">
                        <input
                          type="checkbox"
                          checked={item.autoPost}
                          onChange={(event) => handleToggleAutoPost(item.id, event.target.checked)}
                          className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                        />
                        Auto
                      </label>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => handleRunNow(item.id)}
                          disabled={isPending}
                          className="gap-1"
                        >
                          <Play className="h-4 w-4" />
                          Run now
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(item.id)}
                          disabled={isPending}
                        >
                          <Trash2 className="h-4 w-4 text-rose-500" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function pad(value: number) {
  return value.toString().padStart(2, "0");
}

function renderScheduleText(schedule: RecurringScheduleInput) {
  if (schedule.mode === "weekly") {
    return `Mingguan - ${WEEKDAY_LABELS[schedule.dayOfWeek]} ${pad(schedule.hour ?? 7)}:${pad(schedule.minute ?? 0)}`;
  }
  return `Bulanan tanggal ${schedule.dayOfMonth} ${pad(schedule.hour ?? 7)}:${pad(schedule.minute ?? 0)}`;
}

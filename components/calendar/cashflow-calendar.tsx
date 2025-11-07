"use client";

import * as Popover from "@radix-ui/react-popover";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, AlertTriangle, TrendingUp, TrendingDown } from "lucide-react";
import { addDays, addMonths, format, isSameMonth, startOfMonth, startOfWeek } from "date-fns";
import { useMemo, useState } from "react";

import type { CashflowCalendarEntry } from "@/types/calendar";
import { cn } from "@/lib/utils";

interface CashflowCalendarProps {
  entries: CashflowCalendarEntry[];
  paydayHints?: Array<{ date: string; label: string }>;
}

function getSeverity(entry: CashflowCalendarEntry) {
  const net = entry.income - entry.expense;
  if (net >= 0) return "positive";
  if (entry.expense > entry.income * 1.5) return "alert";
  return "negative";
}

function DailyCell({ date, month, entry, paydayLabel }: { date: Date; month: Date; entry?: CashflowCalendarEntry; paydayLabel?: string }) {
  const severity = entry ? getSeverity(entry) : null;
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          className={cn(
            "relative h-16 rounded-2xl border text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500",
            isSameMonth(date, month) ? "border-slate-200 bg-white/80 dark:border-white/10 dark:bg-slate-900/70" : "border-transparent bg-transparent opacity-50",
            severity === "positive" && "border-emerald-300/60 bg-emerald-50/80 text-emerald-700 dark:border-emerald-400/40 dark:bg-emerald-500/10 dark:text-emerald-200",
            severity === "negative" && "border-orange-300/60 bg-orange-50/80 text-orange-700 dark:border-orange-400/40 dark:bg-orange-500/10 dark:text-orange-200",
            severity === "alert" && "border-rose-300/60 bg-rose-50/80 text-rose-700 dark:border-rose-400/40 dark:bg-rose-500/10 dark:text-rose-200",
          )}
        >
          <span className="block text-xs font-semibold">{format(date, "d")}</span>
          {entry ? (
            <span className="mt-1 block text-[10px] text-slate-500 dark:text-slate-300">
              {entry.label ?? (entry.type === "recurring" ? "Recurring" : entry.type === "big-expense" ? "Big spend" : "Net")}
            </span>
          ) : null}
          {paydayLabel ? (
            <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-cyan-500/10 px-2 py-0.5 text-[10px] text-cyan-600 dark:text-cyan-300">
              <CalendarIcon className="h-3 w-3" /> {paydayLabel}
            </span>
          ) : null}
        </button>
      </Popover.Trigger>
      {entry ? (
        <Popover.Content side="top" align="start" className="w-64 rounded-2xl border border-white/40 bg-white/95 p-4 text-sm shadow-xl backdrop-blur dark:border-white/10 dark:bg-slate-900/95">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">{format(date, "EEEE, d MMM")}</p>
          <div className="mt-2 space-y-1">
            <p>
              Income: <span className="font-semibold text-emerald-600 dark:text-emerald-300">{entry.income.toLocaleString()}</span>
            </p>
            <p>
              Expense: <span className="font-semibold text-orange-600 dark:text-orange-300">{entry.expense.toLocaleString()}</span>
            </p>
            <p>
              Net: <span className="font-semibold text-slate-800 dark:text-slate-100">{(entry.income - entry.expense).toLocaleString()}</span>
            </p>
            {entry.direction === "up" ? (
              <p className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-300">
                <TrendingUp className="h-3.5 w-3.5" /> Saldo naik {entry.delta?.toLocaleString()}
              </p>
            ) : entry.direction === "down" ? (
              <p className="flex items-center gap-2 text-xs text-rose-500 dark:text-rose-300">
                <TrendingDown className="h-3.5 w-3.5" /> Saldo turun {entry.delta?.toLocaleString()}
              </p>
            ) : null}
            {entry.alert ? (
              <p className="flex items-center gap-2 text-xs text-rose-500 dark:text-rose-300">
                <AlertTriangle className="h-3.5 w-3.5" /> {entry.alert}
              </p>
            ) : null}
          </div>
        </Popover.Content>
      ) : null}
    </Popover.Root>
  );
}

function generateGrid(month: Date) {
  const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  const days: Date[] = [];
  let cursor = start;
  while (days.length < 42) {
    days.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return days;
}

export function CashflowCalendar({ entries, paydayHints = [] }: CashflowCalendarProps) {
  const [month, setMonth] = useState(new Date());
  const grid = useMemo(() => generateGrid(month), [month]);

  const entryByDate = useMemo(() => {
    const map = new Map<string, CashflowCalendarEntry>();
    for (const entry of entries) {
      map.set(entry.date.slice(0, 10), entry);
    }
    return map;
  }, [entries]);

  const paydayByDate = useMemo(() => {
    const map = new Map<string, string>();
    for (const payday of paydayHints) {
      map.set(payday.date.slice(0, 10), payday.label);
    }
    return map;
  }, [paydayHints]);

  return (
    <section className="rounded-3xl border border-white/30 bg-white/80 p-6 shadow-lg backdrop-blur dark:border-white/10 dark:bg-slate-900/80">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-300">Kalender Cashflow</p>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">{format(month, "MMMM yyyy")}</h2>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/70 p-1 shadow-sm dark:border-white/10 dark:bg-white/5">
          <button
            type="button"
            className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            onClick={() => setMonth((prev) => addMonths(prev, -1))}
            aria-label="Bulan sebelumnya"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            onClick={() => setMonth((prev) => addMonths(prev, 1))}
            aria-label="Bulan berikutnya"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="mb-3 grid grid-cols-7 gap-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {"Sen Sel Rab Kam Jum Sab Min".split(" ").map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-2">
        {grid.map((date) => {
          const key = date.toISOString().slice(0, 10);
          return (
            <DailyCell key={key} date={date} month={month} entry={entryByDate.get(key)} paydayLabel={paydayByDate.get(key)} />
          );
        })}
      </div>
    </section>
  );
}

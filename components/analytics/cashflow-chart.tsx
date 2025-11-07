"use client";

import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";

import { useUserPref } from "@/components/providers/user-pref-provider";

type CashflowEntry = {
  date: string;
  income: number;
  expense: number;
  balance: number;
};

interface CashflowChartProps {
  data: CashflowEntry[];
}

const incomeColor = "#10b981";
const expenseColor = "#f97316";
const balanceColor = "#0ea5e9";
const netColor = "#6366f1";

type CashflowTooltipProps = TooltipContentProps<ValueType, NameType> & {
  formatCurrency: (value: number) => string;
  formatDateLabel: (label: string) => string;
};

function CashflowTooltip({ active, payload, label, formatCurrency, formatDateLabel }: CashflowTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  const income = payload.find((entry) => entry.dataKey === "income")?.value ?? 0;
  const expense = payload.find((entry) => entry.dataKey === "expense")?.value ?? 0;
  const net = (income as number) - (expense as number);
  const balance = payload.find((entry) => entry.dataKey === "balance")?.value ?? 0;

  return (
    <div className="min-w-[220px] rounded-2xl border border-slate-200/70 bg-white/95 px-4 py-3 text-sm shadow-lg backdrop-blur dark:border-slate-700/50 dark:bg-slate-900/90">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {formatDateLabel(label as string)}
      </p>
      <div className="mt-2 space-y-1 text-sm">
        <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-300">
          <span>Pemasukan</span>
          <span className="font-semibold">{formatCurrency(Number(income))}</span>
        </div>
        <div className="flex items-center justify-between text-orange-600 dark:text-orange-300">
          <span>Pengeluaran</span>
          <span className="font-semibold">-{formatCurrency(Number(expense))}</span>
        </div>
        <div className="flex items-center justify-between text-slate-600 dark:text-slate-200">
          <span>Selisih</span>
          <span className="font-semibold">{formatCurrency(net)}</span>
        </div>
        <div className="flex items-center justify-between text-cyan-600 dark:text-cyan-300">
          <span>Saldo Akhir</span>
          <span className="font-semibold">{formatCurrency(Number(balance))}</span>
        </div>
      </div>
    </div>
  );
}

export function CashflowChart({ data }: CashflowChartProps) {
  const { formatCurrency, pref } = useUserPref();
  const compactFormatter = useMemo(
    () =>
      new Intl.NumberFormat(pref.locale, {
        style: "currency",
        currency: pref.currency,
        notation: "compact",
        maximumFractionDigits: 1,
      }),
    [pref.currency, pref.locale],
  );
  const tooltipDateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(pref.locale, {
        weekday: "short",
        day: "numeric",
        month: "short",
      }),
    [pref.locale],
  );
  const axisDateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(pref.locale, {
        day: "numeric",
        month: "short",
      }),
    [pref.locale],
  );

  const chartData = useMemo(
    () =>
      data.map((entry) => ({
        ...entry,
        net: entry.income - entry.expense,
      })),
    [data],
  );

  if (chartData.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-slate-500 dark:text-slate-400">
        Belum ada transaksi bulan ini.
      </div>
    );
  }

  return (
    <div className="h-72 w-full md:h-80 lg:h-[22rem]">
      <ResponsiveContainer>
        <AreaChart data={chartData} margin={{ top: 16, right: 24, left: 8, bottom: 0 }}>
          <defs>
            <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={incomeColor} stopOpacity={0.35} />
              <stop offset="95%" stopColor={incomeColor} stopOpacity={0.05} />
            </linearGradient>
            <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={expenseColor} stopOpacity={0.35} />
              <stop offset="95%" stopColor={expenseColor} stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} strokeDasharray="4 4" stroke="hsl(var(--border))" />
          <XAxis
            dataKey="date"
            tickFormatter={(value) => axisDateFormatter.format(new Date(value))}
            tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
          />
          <YAxis
            tickFormatter={(value) => compactFormatter.format(value)}
            tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
            width={70}
          />
          <Tooltip
            cursor={{ strokeDasharray: "4 4", stroke: "rgba(148, 163, 184, 0.4)" }}
            content={(props) => (
              <CashflowTooltip
                {...props}
                formatCurrency={formatCurrency}
                formatDateLabel={(label) => tooltipDateFormatter.format(new Date(label))}
              />
            )}
          />
          <Legend
            verticalAlign="top"
            align="right"
            iconType="circle"
            formatter={(value) => {
              if (value === "income") return "Pemasukan";
              if (value === "expense") return "Pengeluaran";
              if (value === "balance") return "Saldo";
              if (value === "net") return "Selisih";
              return value;
            }}
          />
          <ReferenceLine y={0} stroke="rgba(148, 163, 184, 0.4)" strokeDasharray="3 3" />
          <Area
            type="monotone"
            name="Pemasukan"
            dataKey="income"
            stroke={incomeColor}
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#incomeGradient)"
            activeDot={{ r: 4 }}
          />
          <Area
            type="monotone"
            name="Pengeluaran"
            dataKey="expense"
            stroke={expenseColor}
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#expenseGradient)"
            activeDot={{ r: 4 }}
          />
          <Line
            name="Saldo"
            dataKey="balance"
            stroke={balanceColor}
            strokeWidth={2.5}
            dot={false}
            type="monotone"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

"use client";

import { useMemo } from "react";
import { useTheme } from "next-themes";
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

type PocketChartPoint = {
  date: string;
  income: number;
  expense: number;
  balanceAfter: number | null;
};

interface PocketChartProps {
  data: PocketChartPoint[];
  formatCurrency: (value: number) => string;
  formatDate: (input: Date | string, options?: Intl.DateTimeFormatOptions) => string;
}

type Palette = {
  grid: string;
  axis: string;
  incomeFill: string;
  expenseFill: string;
  balanceStroke: string;
  netStroke: string;
  tooltipBg: string;
  tooltipText: string;
};

function resolvePalette(theme: string | undefined): Palette {
  if (theme === "dark") {
    return {
      grid: "rgba(148, 163, 184, 0.2)",
      axis: "rgba(226, 232, 240, 0.7)",
      incomeFill: "rgba(34, 197, 94, 0.85)",
      expenseFill: "rgba(248, 113, 113, 0.8)",
      balanceStroke: "rgba(56, 189, 248, 1)",
      netStroke: "rgba(248, 250, 252, 0.8)",
      tooltipBg: "rgba(15, 23, 42, 0.9)",
      tooltipText: "rgba(226, 232, 240, 1)",
    };
  }

  return {
    grid: "rgba(148, 163, 184, 0.2)",
    axis: "rgba(30, 41, 59, 0.6)",
    incomeFill: "rgba(79, 70, 229, 0.85)",
    expenseFill: "rgba(248, 113, 113, 0.8)",
    balanceStroke: "rgba(14, 165, 233, 1)",
    netStroke: "rgba(5, 150, 105, 1)",
    tooltipBg: "rgba(255, 255, 255, 0.95)",
    tooltipText: "rgba(15, 23, 42, 1)",
  };
}

type PocketTooltipProps = TooltipContentProps<ValueType, NameType> & {
  formatCurrency: (value: number) => string;
  formatDate: (input: Date | string, options?: Intl.DateTimeFormatOptions) => string;
  palette: Palette;
};

function PocketTooltip({ active, payload, label, formatCurrency, formatDate, palette }: PocketTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  const dateLabel = formatDate(label as string, { day: "2-digit", month: "short" });

  const income = payload.find((entry) => entry.dataKey === "income")?.value ?? 0;
  const expense = payload.find((entry) => entry.dataKey === "expenseNegative")?.value ?? 0;
  const net = payload.find((entry) => entry.dataKey === "net")?.value ?? 0;
  const balance = payload.find((entry) => entry.dataKey === "balanceAfter")?.value ?? 0;

  return (
    <div
      className="rounded-2xl border px-4 py-3 text-sm shadow-lg backdrop-blur"
      style={{
        borderColor: palette.grid,
        backgroundColor: palette.tooltipBg,
        color: palette.tooltipText,
      }}
    >
      <p className="mb-2 text-xs uppercase tracking-wide">{dateLabel}</p>
      <p>
        Income: <span className="font-semibold">{formatCurrency(Number(income ?? 0))}</span>
      </p>
      <p>
        Expense: <span className="font-semibold">{formatCurrency(Math.abs(Number(expense ?? 0)))}</span>
      </p>
      <p>
        Selisih: <span className="font-semibold">{formatCurrency(Number(net ?? 0))}</span>
      </p>
      <p>
        Saldo: <span className="font-semibold">{formatCurrency(Number(balance ?? 0))}</span>
      </p>
    </div>
  );
}

export function PocketChart({ data, formatCurrency, formatDate }: PocketChartProps) {
  const { resolvedTheme } = useTheme();
  const palette = useMemo(() => resolvePalette(resolvedTheme), [resolvedTheme]);
  const chartData = useMemo(
    () =>
      (data ?? []).map((entry) => ({
        ...entry,
        expenseNegative: -entry.expense,
        net: entry.income - entry.expense,
      })),
    [data],
  );

  if (!chartData || chartData.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-3xl border border-dashed border-slate-300/80 bg-white/40 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300">
        Belum ada data cashflow untuk rentang ini.
      </div>
    );
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 16, right: 24, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="pocketIncomeGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={palette.incomeFill} stopOpacity={0.4} />
              <stop offset="95%" stopColor={palette.incomeFill} stopOpacity={0.05} />
            </linearGradient>
            <linearGradient id="pocketExpenseGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={palette.expenseFill} stopOpacity={0.35} />
              <stop offset="95%" stopColor={palette.expenseFill} stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="4 4" stroke={palette.grid} />
          <XAxis
            dataKey="date"
            tickFormatter={(value) => formatDate(value, { day: "2-digit", month: "short" })}
            stroke={palette.axis}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tickFormatter={(value) => formatCurrency(Number(value))}
            stroke={palette.axis}
            tickLine={false}
            axisLine={false}
            width={80}
          />
          <Tooltip
            cursor={{ stroke: palette.grid, strokeDasharray: "3 3" }}
            content={(props) => (
              <PocketTooltip
                {...props}
                formatCurrency={formatCurrency}
                formatDate={formatDate}
                palette={palette}
              />
            )}
          />
          <Legend
            verticalAlign="top"
            align="right"
            iconType="circle"
          />
          <ReferenceLine y={0} stroke={palette.grid} strokeDasharray="3 3" />
          <Area
            type="monotone"
            dataKey="income"
            name="Income"
            stroke={palette.incomeFill}
            strokeWidth={2}
            fill="url(#pocketIncomeGradient)"
            activeDot={{ r: 4 }}
          />
          <Area
            type="monotone"
            dataKey="expenseNegative"
            name="Expense"
            stroke={palette.expenseFill}
            strokeWidth={2}
            fill="url(#pocketExpenseGradient)"
            activeDot={{ r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="net"
            name="Net"
            stroke={palette.netStroke}
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
          <Line
            type="monotone"
            dataKey="balanceAfter"
            name="Saldo"
            stroke={palette.balanceStroke}
            strokeWidth={2}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export default PocketChart;

import { beforeEach, describe, expect, it } from "vitest";

import { getPocketCashflowSeries, getPocketStats } from "@/app/pockets/actions";
import { prisma } from "@/lib/prisma";

function toDate(value: string) {
  return new Date(value);
}

describe.sequential("pocket insight actions", () => {
  let pocketId: string;
  const range = {
    from: toDate("2024-05-01T00:00:00.000Z"),
    to: toDate("2024-05-07T00:00:00.000Z"),
  };

  beforeEach(async () => {
    await prisma.transaction.deleteMany();
    await prisma.recurring.deleteMany();
    await prisma.pocket.deleteMany();

    const pocket = await prisma.pocket.create({
      data: {
        name: "Tabungan Lebaran",
        icon: "wallet",
        color: "#0ea5e9",
        balance: 0,
        monthlyBudget: 100_000,
        goalAmount: 0,
        order: 1,
        isActive: true,
      },
    });

    pocketId = pocket.id;

    await prisma.transaction.createMany({
      data: [
        {
          type: "income",
          amount: 150_000,
          pocketId,
          date: toDate("2024-05-01T12:00:00.000Z"),
          source: "manual",
        },
        {
          type: "expense",
          amount: 70_000,
          pocketId,
          date: toDate("2024-05-02T13:00:00.000Z"),
          source: "manual",
          note: "Belanja sembako",
        },
        {
          type: "expense",
          amount: 60_000,
          pocketId,
          date: toDate("2024-05-04T15:30:00.000Z"),
          source: "manual",
          note: "Buka puasa",
        },
        {
          type: "income",
          amount: 50_000,
          pocketId,
          date: toDate("2024-05-06T12:30:00.000Z"),
          source: "manual",
        },
      ],
    });
  });

  it("menghitung statistik pocket dengan overspend yang benar", async () => {
    const statsResult = await getPocketStats(pocketId, range);
    expect(statsResult.success).toBe(true);
    if (!statsResult.success) return;

    const stats = statsResult.data;
    expect(stats.totalIncome).toBe(200_000);
    expect(stats.totalExpense).toBe(130_000);
    expect(stats.avgDailyExpense).toBeCloseTo(130_000 / 7, 2);
    expect(stats.overspend).toBe(true);
    expect(stats.overspendPct).toBeCloseTo(130, 1);
    expect(stats.topExpense?.amount).toBe(70_000);
  });

  it("mengembalikan seri cashflow harian terurut", async () => {
    const cashflowResult = await getPocketCashflowSeries(pocketId, "daily", range);
    expect(cashflowResult.success).toBe(true);
    if (!cashflowResult.success) return;

    const series = cashflowResult.data;
    expect(series).toHaveLength(4);
    const incomes = series.map((point) => point.income);
    const expenses = series.map((point) => point.expense);
    const dates = series.map((point) => point.date);
    expect(dates).toEqual([...dates].sort());
    expect(incomes).toEqual([150_000, 0, 0, 50_000]);
    expect(expenses).toEqual([0, 70_000, 60_000, 0]);
  });
});

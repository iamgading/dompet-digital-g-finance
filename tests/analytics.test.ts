import { beforeEach, describe, expect, it } from "vitest";

import { getCashflowSummary, getInsights } from "@/app/actions/analytics";
import { prisma } from "@/lib/prisma";

describe.sequential("analytics actions", () => {
  beforeEach(async () => {
    await prisma.transaction.deleteMany();
    await prisma.recurring.deleteMany();
    await prisma.pocket.deleteMany();
  });

  it("computes cashflow summary for a month", async () => {
    const pocket = await prisma.pocket.create({
      data: {
        name: "Dompet",
        icon: null,
        color: null,
        balance: 0,
        monthlyBudget: 0,
        goalAmount: 0,
        order: 1,
        isActive: true,
      },
    });

    await prisma.transaction.createMany({
      data: [
        {
          type: "income",
          amount: 100_000,
          pocketId: pocket.id,
          date: new Date("2024-05-02T00:00:00Z"),
          note: "Gaji",
          source: "manual",
        },
        {
          type: "expense",
          amount: 40_000,
          pocketId: pocket.id,
          date: new Date("2024-05-03T00:00:00Z"),
          note: "Belanja",
          source: "manual",
        },
      ],
    });

    const result = await getCashflowSummary({ month: "2024-05-01" });
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data).toHaveLength(2);
    const first = result.data[0];
    expect(first.income).toBe(100_000);
    expect(first.expense).toBe(0);
    expect(first.balance).toBe(100_000);
    const second = result.data[1];
    expect(second.expense).toBe(40_000);
    expect(second.balance).toBe(60_000);
  });

  it("generates overspend and saving insights", async () => {
    await prisma.pocket.createMany({
      data: [
        {
          name: "Kebutuhan",
          icon: null,
          color: null,
          balance: 10_000,
          monthlyBudget: 100_000,
          goalAmount: 0,
          order: 1,
          isActive: true,
        },
        {
          name: "Tabungan",
          icon: null,
          color: null,
          balance: 200_000,
          monthlyBudget: 0,
          goalAmount: 0,
          order: 2,
          isActive: true,
        },
      ],
    });

    const result = await getInsights();
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.some((insight) => insight.type === "overspend")).toBe(true);
    expect(result.data.some((insight) => insight.type === "saving")).toBe(true);
  });
});

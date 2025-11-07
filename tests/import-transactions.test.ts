import { beforeEach, describe, expect, it, vi } from "vitest";

import { importTransactions } from "@/app/actions/finance";
import { prisma } from "@/lib/prisma";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("importTransactions action", () => {
  let targetPocketId: string;

  beforeEach(async () => {
    await prisma.transaction.deleteMany();
    await prisma.recurring.deleteMany();
    await prisma.pocket.deleteMany();

    await prisma.pocket.create({
      data: {
        name: "Tabungan",
        icon: "piggy-bank",
        color: "#0ea5e9",
        balance: 0,
        monthlyBudget: 0,
        goalAmount: 0,
        order: 1,
        isActive: true,
      },
    });

    const eMoney = await prisma.pocket.create({
      data: {
        name: "E-Money",
        icon: "smartphone",
        color: "#a855f7",
        balance: 0,
        monthlyBudget: 0,
        goalAmount: 0,
        order: 2,
        isActive: true,
      },
    });

    targetPocketId = eMoney.id;
  });

  it("skips duplicate rows with the same external reference", async () => {
    const todayIso = new Date().toISOString();

    const result = await importTransactions({
      defaultPocketId: targetPocketId,
      rows: [
        {
          date: todayIso,
          description: "Top up OVO",
          amount: -50_000,
          note: "Top up",
          pocketId: targetPocketId,
          externalRef: "ref-ovo-01",
        },
        {
          date: todayIso,
          description: "Top up OVO",
          amount: -50_000,
          note: "Top up",
          pocketId: targetPocketId,
          externalRef: "ref-ovo-01",
        },
      ],
    });

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.totalRows).toBe(2);
    expect(result.data.created).toHaveLength(1);
    expect(result.data.duplicates).toHaveLength(1);
    expect(result.data.failures).toHaveLength(0);
  });
});

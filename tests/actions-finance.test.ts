import { beforeEach, describe, expect, it } from "vitest";

import {
  createTransaction,
  getTotalBalance,
  listPockets,
  transferBetweenPockets,
} from "@/app/actions/finance";
import { prisma } from "@/lib/prisma";

describe.sequential("finance actions", () => {
  let tabunganId: string;
  let kebutuhanId: string;
  let eMoneyId: string;

  beforeEach(async () => {
    await prisma.transaction.deleteMany();
    await prisma.recurring.deleteMany();
    await prisma.pocket.deleteMany();

    const tabungan = await prisma.pocket.create({
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
    const kebutuhan = await prisma.pocket.create({
      data: {
        name: "Kebutuhan Pokok",
        icon: "shopping-basket",
        color: "#22c55e",
        balance: 0,
        monthlyBudget: 0,
        goalAmount: 0,
        order: 2,
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
        order: 3,
        isActive: true,
      },
    });

    tabunganId = tabungan.id;
    kebutuhanId = kebutuhan.id;
    eMoneyId = eMoney.id;
  });

  it("creates income transaction and increases total", async () => {
    const createResult = await createTransaction({
      type: "income",
      amount: 100_000,
      pocketId: tabunganId,
      note: "Bonus",
    });

    expect(createResult.success).toBe(true);
    if (!createResult.success) return;

    expect(createResult.data.pocket.balance).toBe(100_000);
    expect(createResult.data.total).toBe(100_000);
  });

  it("creates expense transaction and decreases total", async () => {
    await createTransaction({
      type: "income",
      amount: 200_000,
      pocketId: kebutuhanId,
    });

    const expenseResult = await createTransaction({
      type: "expense",
      amount: 50_000,
      pocketId: kebutuhanId,
      note: "Belanja mingguan",
    });

    expect(expenseResult.success).toBe(true);
    if (!expenseResult.success) return;

    expect(expenseResult.data.pocket.balance).toBe(150_000);
    expect(expenseResult.data.total).toBe(150_000);
  });

  it("transfers between pockets without changing total balance", async () => {
    await createTransaction({
      type: "income",
      amount: 80_000,
      pocketId: tabunganId,
    });

    const beforePocketsResult = await listPockets();
    if (!beforePocketsResult.success) throw new Error("Gagal memuat pocket sebelum transfer");
    const beforeSum = beforePocketsResult.data.reduce((acc, pocket) => acc + pocket.balance, 0);

    const transferResult = await transferBetweenPockets({
      fromId: tabunganId,
      toId: eMoneyId,
      amount: 30_000,
    });

    expect(transferResult.success).toBe(true);
    if (!transferResult.success) return;

    const afterPocketsResult = await listPockets();
    if (!afterPocketsResult.success) throw new Error("Gagal memuat pocket setelah transfer");

    const afterSum = afterPocketsResult.data.reduce((acc, pocket) => acc + pocket.balance, 0);
    const refreshedFrom = afterPocketsResult.data.find((pocket) => pocket.id === tabunganId);
    const refreshedTo = afterPocketsResult.data.find((pocket) => pocket.id === eMoneyId);

    expect(afterSum).toBe(beforeSum);
    expect(transferResult.data.total).toBe(afterSum);
    expect(refreshedFrom?.balance).toBe(50_000);
    expect(refreshedTo?.balance).toBe(30_000);
    expect(transferResult.data.fromPocket.balance).toBe(50_000);
    expect(transferResult.data.toPocket.balance).toBe(30_000);
  });

  it("reuses existing transaction when clientRef matches", async () => {
    const payload = {
      type: "income" as const,
      amount: 45_000,
      pocketId: tabunganId,
      clientRef: "offline-test-123",
      note: "Offline sync",
    };

    const first = await createTransaction(payload);
    expect(first.success).toBe(true);

    const second = await createTransaction(payload);
    expect(second.success).toBe(true);

    if (!first.success || !second.success) return;

    const count = await prisma.transaction.count({
      where: { pocketId: tabunganId, externalRef: payload.clientRef },
    });

    expect(count).toBe(1);
    expect(second.data.pocket.balance).toBe(first.data.pocket.balance);
    expect(second.data.total).toBe(first.data.total);
  });

  it("rejects invalid amount", async () => {
    const result = await createTransaction({
      type: "income",
      amount: 0,
      pocketId: tabunganId,
    } as unknown as Parameters<typeof createTransaction>[0]);

    expect(result.success).toBe(false);
  });
});

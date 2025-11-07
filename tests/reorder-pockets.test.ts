import { beforeEach, describe, expect, it, vi } from "vitest";

import { listPockets } from "@/app/actions/finance";
import { reorderPockets as repoReorderPockets } from "@/lib/repo/pockets";
import { prisma } from "@/lib/prisma";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe.sequential("reorder pockets action", () => {
  beforeEach(async () => {
    await prisma.transaction.deleteMany();
    await prisma.recurring.deleteMany();
    await prisma.pocket.deleteMany();

    const basePockets = [
      { name: "Tabungan", icon: "piggy-bank", color: "#0ea5e9" },
      { name: "Kebutuhan Pokok", icon: "shopping-basket", color: "#22c55e" },
      { name: "Invest", icon: "trending-up", color: "#06b6d4" },
      { name: "E-Money", icon: "smartphone", color: "#a855f7" },
    ];

    for (const [index, entry] of basePockets.entries()) {
      await prisma.pocket.create({
        data: {
          name: entry.name,
          icon: entry.icon,
          color: entry.color,
          balance: 0,
          monthlyBudget: 0,
          goalAmount: 0,
          order: index + 1,
          isActive: true,
        },
      });
    }
  });

  it("moves a pocket up by one step", async () => {
    const pockets = await prisma.pocket.findMany({ orderBy: { order: "asc" } });
    expect(pockets.length).toBeGreaterThan(1);

    const target = pockets[1];
    const swapped = pockets[0];

    const newOrder = [...pockets.map((pocket) => pocket.id)];
    [newOrder[0], newOrder[1]] = [newOrder[1], newOrder[0]];

    await repoReorderPockets(newOrder.map((id, index) => ({ id, order: index + 1 })));

    const afterPockets = await prisma.pocket.findMany({ orderBy: { order: "asc" } });
    const updatedTarget = afterPockets.find((pocket) => pocket.id === target.id);
    const updatedSwapped = afterPockets.find((pocket) => pocket.id === swapped.id);
    const expectedTargetIndex = newOrder.indexOf(target.id);
    const expectedSwappedIndex = newOrder.indexOf(swapped.id);
    const targetIndexAfter = afterPockets.findIndex((pocket) => pocket.id === target.id);
    const swappedIndexAfter = afterPockets.findIndex((pocket) => pocket.id === swapped.id);

    expect(targetIndexAfter).toBe(expectedTargetIndex);
    expect(swappedIndexAfter).toBe(expectedSwappedIndex);
    expect(updatedTarget?.order).toBe(expectedTargetIndex + 1);
    expect(updatedSwapped?.order).toBe(expectedSwappedIndex + 1);
  });

  it("moves a pocket down by one step", async () => {
    const pockets = await prisma.pocket.findMany({ orderBy: { order: "asc" } });
    expect(pockets.length).toBeGreaterThan(2);

    const target = pockets[1];
    const swapped = pockets[2];

    const newOrder = [...pockets.map((pocket) => pocket.id)];
    [newOrder[1], newOrder[2]] = [newOrder[2], newOrder[1]];

    await repoReorderPockets(newOrder.map((id, index) => ({ id, order: index + 1 })));

    const afterPockets = await prisma.pocket.findMany({ orderBy: { order: "asc" } });
    const updatedTarget = afterPockets.find((pocket) => pocket.id === target.id);
    const updatedSwapped = afterPockets.find((pocket) => pocket.id === swapped.id);
    const expectedTargetIndex = newOrder.indexOf(target.id);
    const expectedSwappedIndex = newOrder.indexOf(swapped.id);
    const targetIndexAfter = afterPockets.findIndex((pocket) => pocket.id === target.id);
    const swappedIndexAfter = afterPockets.findIndex((pocket) => pocket.id === swapped.id);

    expect(targetIndexAfter).toBe(expectedTargetIndex);
    expect(swappedIndexAfter).toBe(expectedSwappedIndex);
    expect(updatedTarget?.order).toBe(expectedTargetIndex + 1);
    expect(updatedSwapped?.order).toBe(expectedSwappedIndex + 1);
  });
});

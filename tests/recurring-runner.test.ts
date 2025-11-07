import { beforeEach, describe, expect, it, vi } from "vitest";

import { runDueRecurring } from "@/app/actions/recurring";
import { prisma } from "@/lib/prisma";
import { upsertRecurring } from "@/lib/repo/recurring";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache: (fn: (...args: any[]) => any) => (...args: any[]) => fn(...args),
}));

describe.sequential("recurring runner", () => {
  let pocketId: string;
  let profileId: string;

  beforeEach(async () => {
    await prisma.transaction.deleteMany();
    await prisma.recurring.deleteMany();
    await prisma.pocket.deleteMany();
    await prisma.profile.deleteMany();
    await prisma.userPref.deleteMany();

    const profile = await prisma.profile.create({
      data: {
        name: "Pribadi",
        desc: "Profil default",
      },
    });
    profileId = profile.id;

    const pocket = await prisma.pocket.create({
      data: {
        name: "Tabungan",
        icon: "piggy-bank",
        color: "#0ea5e9",
        balance: 0,
        monthlyBudget: 0,
        goalAmount: 0,
        order: 1,
        isActive: true,
        profileId,
      },
    });
    pocketId = pocket.id;

    await prisma.userPref.create({
      data: {
        activeProfileId: profileId,
      },
    });
  });

  it("executes due recurring and keeps total balance", async () => {
    const schedule = {
      mode: "weekly" as const,
      dayOfWeek: new Date().getDay(),
      hour: 0,
      minute: 0,
    };

    const recurring = await upsertRecurring(
      {
        name: "Gaji Mingguan",
        type: "income",
        amount: 100_000,
        pocketId,
        schedule,
        autoPost: true,
      },
      profileId,
    );

    await prisma.recurring.update({
      where: { id: recurring.id },
      data: {
        nextRunAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      },
    });

    const beforePocket = await prisma.pocket.findUnique({ where: { id: pocketId } });

    const beforeRecurring = await prisma.recurring.findUnique({ where: { id: recurring.id } });

    const result = await runDueRecurring();
    expect(result.success).toBe(true);
    if (!result.success) return;

    const afterPocket = await prisma.pocket.findUnique({ where: { id: pocketId } });
    expect(afterPocket?.balance ?? 0).toBe((beforePocket?.balance ?? 0) + 100_000);

    const afterRecurring = await prisma.recurring.findUnique({ where: { id: recurring.id } });
    expect(afterRecurring?.lastRunAt).not.toBeNull();
    if (beforeRecurring?.nextRunAt && afterRecurring?.nextRunAt) {
      expect(afterRecurring.nextRunAt.getTime()).toBeGreaterThan(beforeRecurring.nextRunAt.getTime());
    }
  });
});

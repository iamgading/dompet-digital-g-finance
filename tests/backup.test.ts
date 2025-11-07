import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTransaction } from "@/app/actions/finance";
import { exportBackupData, restoreBackupData } from "@/app/actions/backup";
import { prisma } from "@/lib/prisma";
import { decryptJson, encryptJson } from "@/lib/crypto";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache: (fn: (...args: any[]) => any) => (...args: any[]) => fn(...args),
}));

describe.sequential("backup round trip", () => {
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

  it("exports, encrypts, restores data", async () => {
    await createTransaction({
      type: "income",
      amount: 75_000,
      pocketId,
      note: "Test income",
    });

    const backup = await exportBackupData();
    expect(backup.success).toBe(true);
    if (!backup.success) return;

    const passphrase = "pass123";
    const encrypted = await encryptJson(backup.data, passphrase);
    const decrypted = await decryptJson<typeof backup.data>(encrypted, passphrase);

    await prisma.transaction.deleteMany();
    await prisma.recurring.deleteMany();
    await prisma.pocket.deleteMany();
    await prisma.profile.deleteMany();
    await prisma.userPref.deleteMany();

    const restore = await restoreBackupData({ payload: decrypted });
    expect(restore.success).toBe(true);

    const transactionsAfter = await prisma.transaction.findMany();
    expect(transactionsAfter).not.toHaveLength(0);
  });
});

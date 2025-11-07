import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";

import { seed, prisma } from "@/prisma/seed";

describe("Pocket seed", () => {
  const testPrisma = prisma instanceof PrismaClient ? prisma : new PrismaClient();

  beforeAll(async () => {
    await testPrisma.transaction.deleteMany();
    await testPrisma.recurring.deleteMany();
    await testPrisma.pocket.deleteMany();
    await seed();
  });

  afterAll(async () => {
    await testPrisma.$disconnect();
  });

  it("creates four active pockets", async () => {
    const pockets = await testPrisma.pocket.findMany({
      where: { isActive: true },
    });

    expect(pockets).toHaveLength(4);
  });
});

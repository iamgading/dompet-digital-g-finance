import { beforeAll, afterAll, beforeEach, describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { PrismaClient } from "@prisma/client";

import { createEmptyState, step, type PocketOption } from "@/lib/assistant/dialog-manager";
import { execPlan, undoByToken } from "@/app/assistant/assistant-exec";
import { buildPocketAliases } from "@/lib/nlu/pocket-alias";

process.env.DATABASE_URL = process.env.DATABASE_URL ?? "file:./prisma/test-assistant.db";

const TEST_DB_PATH = path.resolve(process.cwd(), "prisma", "test-assistant.db");

let prisma: PrismaClient;
let pocketOptions: PocketOption[] = [];

beforeAll(async () => {
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.rmSync(TEST_DB_PATH);
  }
  const migrate = spawnSync("npx", ["prisma", "migrate", "deploy"], {
    env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
    stdio: "inherit",
  });
  if (migrate.status !== 0) {
    throw new Error("Failed to run migrations for test database.");
  }
  prisma = new PrismaClient();
});

afterAll(async () => {
  await prisma.$disconnect();
});

async function seedPockets() {
  await prisma.transaction.deleteMany();
  await prisma.journal.deleteMany();
  await prisma.chatTurn.deleteMany();
  await prisma.chatSession.deleteMany();
  await prisma.pocket.deleteMany();

  const tabungan = await prisma.pocket.create({
    data: {
      name: "Tabungan",
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
      balance: 0,
      monthlyBudget: 0,
      goalAmount: 0,
      order: 2,
      isActive: true,
    },
  });
  const emoney = await prisma.pocket.create({
    data: {
      name: "E-Money",
      balance: 0,
      monthlyBudget: 0,
      goalAmount: 0,
      order: 3,
      isActive: true,
    },
  });

  pocketOptions = [
    { id: tabungan.id, name: tabungan.name },
    { id: kebutuhan.id, name: kebutuhan.name },
    { id: emoney.id, name: emoney.name },
  ];
}

beforeEach(async () => {
  await seedPockets();
});

describe("Dialog manager flow", () => {
  it("handles income flow until execution and undo", async () => {
    const aliases = await buildPocketAliases();
    let state = createEmptyState();

    const first = step({
      text: "aku dapat gaji 3jt400 hari ini",
      state,
      pockets: pocketOptions,
      aliases,
    });
    state = first.state;
    expect(state.intent).toBe("income_to_pocket");
    expect(state.amount).toBe(3_400_000);
    expect(first.message.toLowerCase()).toContain("pocket");

    const pocketAnswer = step({
      text: "Tabungan",
      state,
      pockets: pocketOptions,
      aliases,
    });
    state = pocketAnswer.state;
    expect(state.pocket?.name).toBe("Tabungan");
    expect(pocketAnswer.message.toLowerCase()).toContain("catatan");

    const noteAnswer = step({
      text: "tidak",
      state,
      pockets: pocketOptions,
      aliases,
    });
    state = noteAnswer.state;
    expect(noteAnswer.message.toLowerCase()).toContain("tambahkan pemasukan");

    const confirm = step({
      text: "ya",
      state,
      pockets: pocketOptions,
      aliases,
    });
    state = confirm.state;
    expect(confirm.execute).toBe(true);
    expect(confirm.plan?.kind).toBe("income");

    const exec = await execPlan(confirm.plan!);
    if (!exec.success) {
      throw new Error(exec.error);
    }

    const tabungan = await prisma.pocket.findUniqueOrThrow({
      where: { id: state.pocket?.id ?? pocketOptions[0].id },
    });
    expect(tabungan.balance).toBe(3_400_000);

    const undo = await undoByToken(exec.undoToken);
    expect(undo.success).toBe(true);

    const reverted = await prisma.pocket.findUniqueOrThrow({
      where: { id: tabungan.id },
    });
    expect(reverted.balance).toBe(0);
  });

  it("guides transfer with slot filling, executes, and undo restores balances", async () => {
    const aliases = await buildPocketAliases();
    let state = createEmptyState();

    await prisma.pocket.update({
      where: { id: pocketOptions[0].id },
      data: { balance: 1_000_000 },
    });

    const init = step({
      text: "aku mau kirim saldo",
      state,
      pockets: pocketOptions,
      aliases,
    });
    state = init.state;
    expect(state.intent).toBe("transfer_between_pockets");
    expect(init.message.toLowerCase()).toContain("nominal");

    const amount = step({
      text: "200k",
      state,
      pockets: pocketOptions,
      aliases,
    });
    state = amount.state;
    expect(state.amount).toBe(200_000);
    expect(amount.message.toLowerCase()).toContain("diambil");

    const fromPocket = step({
      text: "Tabungan",
      state,
      pockets: pocketOptions,
      aliases,
    });
    state = fromPocket.state;
    expect(state.pocketFrom?.name).toBe("Tabungan");
    expect(fromPocket.message.toLowerCase()).toContain("tujuan");

    const samePocketAttempt = step({
      text: "Tabungan",
      state,
      pockets: pocketOptions,
      aliases,
    });
    state = samePocketAttempt.state;
    expect(samePocketAttempt.message.toLowerCase()).toContain("tidak boleh sama");

    const toPocket = step({
      text: "E-Money",
      state,
      pockets: pocketOptions,
      aliases,
    });
    state = toPocket.state;
    expect(state.pocketTo?.name).toBe("E-Money");
    expect(toPocket.message.toLowerCase()).toContain("catatan");

    const note = step({
      text: "top up",
      state,
      pockets: pocketOptions,
      aliases,
    });
    state = note.state;
    expect(note.message.toLowerCase()).toContain("transfer");

    const confirm = step({
      text: "ya",
      state,
      pockets: pocketOptions,
      aliases,
    });
    state = confirm.state;
    expect(confirm.execute).toBe(true);
    expect(confirm.plan?.kind).toBe("transfer");

    const beforeTabungan = await prisma.pocket.findUniqueOrThrow({ where: { id: pocketOptions[0].id } });
    const beforeEmoney = await prisma.pocket.findUniqueOrThrow({ where: { id: pocketOptions[2].id } });

    const exec = await execPlan(confirm.plan!);
    if (!exec.success) {
      throw new Error(exec.error);
    }

    const afterTabungan = await prisma.pocket.findUniqueOrThrow({ where: { id: pocketOptions[0].id } });
    const afterEmoney = await prisma.pocket.findUniqueOrThrow({ where: { id: pocketOptions[2].id } });
    expect(afterTabungan.balance).toBe(beforeTabungan.balance - 200_000);
    expect(afterEmoney.balance).toBe(beforeEmoney.balance + 200_000);

    const undo = await undoByToken(exec.undoToken);
    expect(undo.success).toBe(true);

    const revertedTabungan = await prisma.pocket.findUniqueOrThrow({ where: { id: pocketOptions[0].id } });
    const revertedEmoney = await prisma.pocket.findUniqueOrThrow({ where: { id: pocketOptions[2].id } });
    expect(revertedTabungan.balance).toBe(beforeTabungan.balance);
    expect(revertedEmoney.balance).toBe(beforeEmoney.balance);
  });
});

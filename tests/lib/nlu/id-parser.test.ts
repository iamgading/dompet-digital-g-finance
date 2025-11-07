import { describe, expect, it } from "vitest";

import { parseIndoCommand, parseAmountIndo } from "@/lib/nlu/id-parser";
import { generatePocketAliasesFromName, type PocketAlias } from "@/lib/nlu/pocket-alias-utils";

const pockets: PocketAlias[] = [
  {
    id: "tabungan",
    name: "Tabungan",
    aliases: generatePocketAliasesFromName("Tabungan"),
  },
  {
    id: "kebutuhan",
    name: "Kebutuhan Pokok",
    aliases: generatePocketAliasesFromName("Keb. Pokok"),
  },
  {
    id: "emoney",
    name: "E-Money",
    aliases: generatePocketAliasesFromName("E-Money"),
  },
];

describe("parseAmountIndo", () => {
  it("parses rupiah variants", () => {
    expect(parseAmountIndo("20 ribu")).toBe(20_000);
    expect(parseAmountIndo("1.250.000")).toBe(1_250_000);
    expect(parseAmountIndo("1,25jt")).toBe(1_250_000);
    expect(parseAmountIndo("125k")).toBe(125_000);
  });
});

describe("parseIndoCommand", () => {
  it("detects income intent with missing pocket", () => {
    const result = parseIndoCommand("aku dapat gaji 3jt400 hari ini", { pockets });
    expect(result.intent).toBe("income_to_pocket");
    expect(result.entities.amount).toBe(3_400_000);
    expect(result.missing).toContain("pocket");
    expect(result.missing).not.toContain("amount");
  });

  it("detects transfer intent with pockets and note", () => {
    const result = parseIndoCommand("kirim 250k dari tabungan ke e money buat top up", { pockets });
    expect(result.intent).toBe("transfer_between_pockets");
    expect(result.entities.amount).toBe(250_000);
    expect(result.entities.pocketFrom?.toLowerCase()).toBe("tabungan");
    expect(result.entities.pocketTo?.toLowerCase()).toBe("e-money");
    expect(result.entities.note).toBe("top up");
    expect(result.missing).not.toContain("pocketFrom");
    expect(result.missing).not.toContain("pocketTo");
  });

  it("detects expense intent with abbreviated pocket", () => {
    const result = parseIndoCommand("keluarkan 50rb dari keb pokok", { pockets });
    expect(result.intent).toBe("expense_from_pocket");
    expect(result.entities.amount).toBe(50_000);
    expect(result.entities.pocket?.toLowerCase()).toBe("kebutuhan pokok");
    expect(result.missing).not.toContain("pocket");
  });
});

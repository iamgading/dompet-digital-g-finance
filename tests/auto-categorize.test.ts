import { describe, expect, it } from "vitest";

import { autoCategorize } from "@/lib/auto-categorize";

describe("autoCategorize", () => {
  it("recognises groceries merchants", () => {
    const result = autoCategorize("Belanja di Indomaret sore ini");
    expect(result).not.toBeNull();
    expect(result?.pocketName).toBe("Kebutuhan Pokok");
  });

  it("detects e-money providers", () => {
    const result = autoCategorize("Top up OVO via mobile banking");
    expect(result?.pocketName).toBe("E-Money");
  });

  it("returns null when no keywords matched", () => {
    const result = autoCategorize("Pembayaran sekolah bulan ini");
    expect(result).toBeNull();
  });
});

import { describe, expect, it } from "vitest";

import { getNextRun } from "@/lib/schedule";

describe("schedule next run", () => {
  it("computes next weekly occurrence on same day if time ahead", () => {
    const now = new Date("2024-05-06T07:00:00Z"); // Monday
    const next = getNextRun(now, { mode: "weekly", dayOfWeek: 1, hour: 9, minute: 30 });
    expect(next.toISOString()).toBe("2024-05-06T09:30:00.000Z");
  });

  it("rolls weekly schedule to next week if time passed", () => {
    const now = new Date("2024-05-06T10:00:00Z");
    const next = getNextRun(now, { mode: "weekly", dayOfWeek: 1, hour: 9, minute: 30 });
    expect(next.toISOString()).toBe("2024-05-13T09:30:00.000Z");
  });

  it("handles monthly schedule with shorter months", () => {
    const now = new Date("2024-02-01T05:00:00Z");
    const next = getNextRun(now, { mode: "monthly", dayOfMonth: 31, hour: 7 });
    expect(next.toISOString()).toBe("2024-02-29T07:00:00.000Z");
  });
});

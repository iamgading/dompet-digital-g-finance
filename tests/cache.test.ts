import { afterEach, describe, expect, it, vi } from "vitest";

import { getTotalBalance } from "@/app/actions/finance";
import { CACHE_TAGS } from "@/lib/cache/tags";
import { revalidateTag } from "next/cache";
import * as repoPockets from "@/lib/repo/pockets";

describe("dashboard caching", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    revalidateTag(CACHE_TAGS.totalBalance);
  });

  it("reuses cached total balance within the cache window", async () => {
    const repoSpy = vi
      .spyOn(repoPockets, "getTotalBalance")
      .mockResolvedValueOnce(100_000)
      .mockResolvedValueOnce(150_000);

    const first = await getTotalBalance();
    expect(first.success).toBe(true);
    if (!first.success) throw new Error(first.error);
    expect(first.data.total).toBe(100_000);

    const second = await getTotalBalance();
    expect(second.success).toBe(true);
    if (!second.success) throw new Error(second.error);
    expect(second.data.total).toBe(100_000);
    expect(repoSpy).toHaveBeenCalledTimes(1);

    revalidateTag(CACHE_TAGS.totalBalance);

    const third = await getTotalBalance();
    expect(third.success).toBe(true);
    if (!third.success) throw new Error(third.error);
    expect(third.data.total).toBe(150_000);
    expect(repoSpy).toHaveBeenCalledTimes(2);
  });
});

import { beforeEach, vi } from "vitest";

import * as actualSupabase from "@/lib/supabase";

import { getMockSupabaseAdminClient, resetSupabase } from "./utils/mock-supabase";
import { prisma, resetPrismaMock } from "./utils/mock-prisma";

const namespaceStore = new Map<string, Map<string, unknown>>();
const tagIndex = new Map<string, Set<string>>();

const unstable_cache = <Args extends unknown[], Result>(
  fn: (...args: Args) => Promise<Result> | Result,
  keys: string[] = [],
  options: { tags?: string[]; revalidate?: number } = {},
) => {
  const namespace = keys.join("|") || fn.name || Math.random().toString(36);
  const store = namespaceStore.get(namespace) ?? new Map<string, unknown>();
  namespaceStore.set(namespace, store);
  const tags = options.tags ?? [];

  return async (...args: Args) => {
    const cacheKey = JSON.stringify(args);
    if (store.has(cacheKey)) {
      return store.get(cacheKey) as Result;
    }
    const result = await fn(...args);
    store.set(cacheKey, result);
    tags.forEach((tag) => {
      const entries = tagIndex.get(tag) ?? new Set<string>();
      entries.add(`${namespace}::${cacheKey}`);
      tagIndex.set(tag, entries);
    });
    return result;
  };
};

const revalidateTag = (tag: string) => {
  const entries = tagIndex.get(tag);
  if (!entries) return;
  for (const entry of entries) {
    const [namespace, cacheKey] = entry.split("::");
    const store = namespaceStore.get(namespace);
    store?.delete(cacheKey);
  }
  tagIndex.delete(tag);
};

vi.mock("next/cache", () => ({
  unstable_cache,
  revalidateTag,
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  ...actualSupabase,
  getSupabaseAdminClient: () => getMockSupabaseAdminClient(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma,
}));

beforeEach(() => {
  resetSupabase();
  resetPrismaMock();
});

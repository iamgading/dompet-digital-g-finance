"use server";

import { checkDbHealth } from "@/lib/health";

export async function dbHealth() {
  return checkDbHealth();
}

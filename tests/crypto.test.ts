import { describe, expect, it } from "vitest";

import { decryptJson, encryptJson } from "@/lib/crypto";

describe("crypto helpers", () => {
  it("encrypts and decrypts payload", async () => {
    const payload = { foo: "bar", count: 42 };
    const passphrase = "secret123";
    const encrypted = await encryptJson(payload, passphrase);
    const decrypted = await decryptJson<typeof payload>(encrypted, passphrase);
    expect(decrypted).toEqual(payload);
  });
});


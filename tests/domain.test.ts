import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import {
  levelForXp,
  isEntitled,
  safeRedirect,
  adDue,
  profileInput,
} from "../src/lib/domain";
import { validMidtransSignature } from "../src/lib/payments";
describe("reward and entitlement boundaries", () => {
  it("uses consistent level thresholds", () => {
    expect([0, 99, 100, 399, 400].map(levelForXp)).toEqual([1, 1, 2, 2, 3]);
  });
  it("expires premium at the exact boundary", () => {
    const now = Date.parse("2026-10-01T00:00:00Z");
    expect(isEntitled(null, now)).toBe(false);
    expect(isEntitled("2026-10-01T00:00:00Z", now)).toBe(false);
    expect(isEntitled("2026-10-01T00:00:01Z", now)).toBe(true);
  });
  it("offers an ad at each configured completion interval only to eligible users", () => {
    expect([0, 1, 2, 3, 4].map((n) => adDue(n, 2, false, false))).toEqual([
      false,
      false,
      true,
      false,
      true,
    ]);
    expect(adDue(2, 2, true, false)).toBe(false);
    expect(adDue(2, 2, false, true)).toBe(false);
    expect(adDue(2, 0, false, false)).toBe(false);
  });
  it("rejects redirect escapes and invalid usernames", () => {
    for (const x of ["//evil.test", "/\\evil.test", "https://evil.test"])
      expect(safeRedirect(x)).toBe("/");
    expect(safeRedirect("/settings/security")).toBe("/settings/security");
    expect(
      profileInput.safeParse({
        username: "<admin>",
        display_name: "A",
        bio: "",
        is_public: true,
      }).success,
    ).toBe(false);
  });
});
describe("Midtrans signature boundary", () => {
  const key = "synthetic-unit-test-secret";
  const order = "order-1";
  const status = "200";
  const amount = "29000.00";
  const signature = createHash("sha512")
    .update(order + status + amount + key)
    .digest("hex");
  it("accepts the official SHA-512 concatenation", () =>
    expect(validMidtransSignature(order, status, amount, signature, key)).toBe(
      true,
    ));
  it("rejects altered prices, orders, keys, and truncated signatures", () => {
    expect(validMidtransSignature(order, status, "1.00", signature, key)).toBe(
      false,
    );
    expect(
      validMidtransSignature("other", status, amount, signature, key),
    ).toBe(false);
    expect(
      validMidtransSignature(order, status, amount, signature, "wrong"),
    ).toBe(false);
    expect(validMidtransSignature(order, status, amount, "abc", key)).toBe(
      false,
    );
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const overview = { current: null };
vi.mock("../../app/shared/api/billing", () => ({ getBilling: async () => ({ ok: true, data: overview.current }) }));

const { entryClosedNow, refreshBilling, resetBilling } = await import("../../app/features/billing/billingStore.js");

async function load(next) {
  overview.current = next;
  await refreshBilling();
}

describe("a closed account is told before the booking form (owner's decision 2026-11-03)", () => {
  beforeEach(() => resetBilling());

  it("is closed only when billing is enforced and the account's access is shut", async () => {
    await load({ visible: true, enforced: true, account: { open: false, state: "ended" } });
    expect(entryClosedNow()).toBe(true);
  });

  it("opens the form while the account is open, billing is not enforced, or nothing is loaded yet", async () => {
    expect(entryClosedNow()).toBe(false);
    await load({ visible: true, enforced: true, account: { open: true, state: "trial" } });
    expect(entryClosedNow()).toBe(false);
    await load({ visible: true, enforced: false, account: { open: false, state: "ended" } });
    expect(entryClosedNow()).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { buildClientHistoryLookup } from "../../app/lib/db/repos/clientHistory.js";

const keysOf = (r) => ({ userId: r.u, phone: r.p, name: r.n });

// The original O(n^2) rule: same client when user id, phone or name matches.
function bruteForce(rows, index) {
  const a = rows[index];
  return rows.filter((b) => (
    (a.u && b.u && String(a.u) === String(b.u))
    || (a.p && b.p && a.p === b.p)
    || (a.n && b.n && a.n === b.n)
  ));
}

describe("buildClientHistoryLookup", () => {
  it("matches the pairwise any-of-user/phone/name rule", () => {
    const rows = [
      { id: 1, u: 5, p: "0912", n: "الف" },
      { id: 2, u: null, p: "0912", n: "ب" },
      { id: 3, u: 5, p: "", n: "" },
      { id: 4, u: null, p: "", n: "ب" },
      { id: 5, u: null, p: "", n: "" },
      { id: 6, u: 9, p: "0999", n: "ج" }
    ];
    const lookup = buildClientHistoryLookup(rows, keysOf);
    rows.forEach((_, index) => {
      expect(lookup(index).map((r) => r.id)).toEqual(bruteForce(rows, index).map((r) => r.id));
    });
  });
});

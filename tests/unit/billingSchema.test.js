import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { BILLING_DDL } from "../../app/lib/db/repos/billing.js";

/** The tables are created two ways (the migration at deploy, the repo on first use); both must be the same DDL. */
const squash = (text) => text.replace(/--[^\n]*/g, "").replace(/\s+/g, " ").trim();

describe("billing schema", () => {
  it("creates the same tables in the migration and on first use", () => {
    const migration = readFileSync("migrations/033_billing.sql", "utf8");
    const up = squash(migration.split("-- Down Migration")[0]);
    for (const statement of BILLING_DDL) expect(up).toContain(squash(statement));
    expect(BILLING_DDL.length).toBe((up.match(/CREATE (UNIQUE )?(TABLE|INDEX)/g) || []).length);
  });
});

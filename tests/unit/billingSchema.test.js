import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { BILLING_DDL } from "../../app/lib/db/repos/billing.js";

/** The tables are created two ways (the migrations at deploy, the repo on first use); both must be the same DDL. */
const squash = (text) => text.replace(/--[^\n]*/g, "").replace(/\s+/g, " ").trim();
const up = (file) => squash(readFileSync(file, "utf8").split("-- Down Migration")[0]);

describe("billing schema", () => {
  it("creates the same tables in the migrations and on first use", () => {
    const migrations = `${up("migrations/033_billing.sql")} ${up("migrations/034_billing_payer_refund.sql")}`;
    for (const statement of BILLING_DDL) expect(migrations).toContain(squash(statement));
    const count = (migrations.match(/CREATE (UNIQUE )?(TABLE|INDEX)|ALTER TABLE/g) || []).length;
    expect(BILLING_DDL.length).toBe(count);
  });
});

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { BILLING_DDL } from "../../app/lib/db/repos/billing.js";

/** The tables are created two ways (the migrations at deploy, the repo on first use); both must be the same DDL. */
const squash = (text) => text.replace(/--[^\n]*/g, "").replace(/\s+/g, " ").trim();
const up = (file) => squash(readFileSync(file, "utf8").split("-- Down Migration")[0]);

describe("billing schema", () => {
  it("creates the same tables in the migrations and on first use", () => {
    const migrations = `${up("migrations/033_billing.sql")} ${up("migrations/034_billing_payer_refund.sql")} ${up("migrations/062_sms_packs.sql")}`;
    for (const statement of BILLING_DDL) expect(migrations).toContain(squash(statement));
    // A DO block (migration 062 swaps a CHECK) is one statement however many ALTERs it holds.
    const blocks = migrations.match(/DO \$\$ .*? END \$\$;/g) || [];
    const flat = migrations.replace(/DO \$\$ .*? END \$\$;/g, "");
    const count = (flat.match(/CREATE (UNIQUE )?(TABLE|INDEX)|ALTER TABLE/g) || []).length + blocks.length;
    expect(BILLING_DDL.length).toBe(count);
  });
});

/**
 * Read-only schema health check for data/zibaban.sqlite.
 * Does not write, migrate, or mutate the database.
 *
 * Usage: node scripts/diagnose-schema.mjs
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

const TARGET_SCHEMA_VERSION = 11;
const dbPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "data",
  "zibaban.sqlite"
);

function mark(ok) {
  return ok ? "✓ موجود" : "✗ غایب";
}

function tableExists(db, name) {
  return Boolean(
    db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?").get(name)
  );
}

function columnExists(db, table, column) {
  if (!tableExists(db, table)) return false;
  return db.prepare(`PRAGMA table_info(${table})`).all().some((col) => col.name === column);
}

function rowCount(db, table) {
  if (!tableExists(db, table)) return 0;
  return Number(db.prepare(`SELECT COUNT(*) AS c FROM "${table}"`).get()?.c || 0);
}

/** True when value looks like epoch ms (or seconds) decimal string, not ISO/SQLite datetime. */
function isEpochExpiry(value) {
  const raw = String(value ?? "").trim();
  if (!/^\d+$/.test(raw)) return false;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return false;
  // ms since ~2001-09, or seconds in same range
  return n >= 1e9;
}

function classifyExpiry(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "empty";
  if (isEpochExpiry(raw)) return "epoch";
  if (raw.includes("T") || /Z$/i.test(raw) || /[+-]\d{2}:\d{2}$/.test(raw)) return "iso";
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}/.test(raw)) return "sqlite_datetime";
  return "other";
}

function checkColumn(db, { version, table, column, note }) {
  const tableOk = tableExists(db, table);
  const colOk = columnExists(db, table, column);
  const rows = tableOk ? rowCount(db, table) : 0;
  const ok = tableOk && colOk;
  return {
    version,
    label: `${table}.${column}`,
    note: note || "",
    ok,
    detail: !tableOk
      ? `جدول ${table} وجود ندارد`
      : !colOk
        ? `ستون غایب — ${rows} ردیف در ${table} تحت تأثیر`
        : `ستون موجود — ${rows} ردیف در ${table}`
  };
}

function main() {
  console.log("=== تشخیص سلامت schema (فقط خواندنی) ===");
  console.log(`مسیر DB: ${dbPath}`);
  console.log("");

  if (!existsSync(dbPath)) {
    console.log("✗ فایل data/zibaban.sqlite پیدا نشد.");
    console.log("نتیجه: دیتابیس واقعی برای بررسی در دسترس نیست.");
    process.exitCode = 1;
    return;
  }

  // Open read-only — refuse writes at the SQLite layer.
  const db = new DatabaseSync(dbPath, { readOnly: true });

  try {
    const metaRow = tableExists(db, "app_meta")
      ? db.prepare("SELECT value FROM app_meta WHERE key = 'schema_version'").get()
      : null;
    const reportedVersion = metaRow?.value == null ? null : Number(metaRow.value);

    console.log("--- 1) app_meta.schema_version ---");
    if (!tableExists(db, "app_meta")) {
      console.log("✗ جدول app_meta غایب است");
    } else if (metaRow == null) {
      console.log("✗ کلید schema_version در app_meta غایب است");
    } else {
      console.log(`مقدار گزارش‌شده: ${reportedVersion}`);
      console.log(
        reportedVersion === TARGET_SCHEMA_VERSION
          ? `✓ برابر TARGET (${TARGET_SCHEMA_VERSION})`
          : `✗ برابر TARGET (${TARGET_SCHEMA_VERSION}) نیست`
      );
    }
    console.log("");

    console.log("--- 2) چک‌لیست migrateToV3 … migrateToV10 ---");
    const checks = [];

    // V3
    checks.push(
      checkColumn(db, {
        version: "V3",
        table: "wallets",
        column: "available_balance",
        note: "migrateToV3"
      })
    );
    checks.push(
      checkColumn(db, {
        version: "V3",
        table: "wallets",
        column: "pending_balance",
        note: "migrateToV3"
      })
    );
    for (const column of ["currency", "type", "status", "ref_type", "ref_id", "balance_after"]) {
      checks.push(
        checkColumn(db, {
          version: "V3",
          table: "wallet_transactions",
          column,
          note: "migrateToV3 (اگر جدول باشد)"
        })
      );
    }

    // V4
    checks.push(
      checkColumn(db, {
        version: "V4",
        table: "posts",
        column: "views_count",
        note: "migrateToV4"
      })
    );

    // V5–V7
    checks.push(
      checkColumn(db, {
        version: "V5",
        table: "salon_services",
        column: "staff_id",
        note: "migrateToV5"
      })
    );
    checks.push(
      checkColumn(db, {
        version: "V6",
        table: "salon_services",
        column: "staff_ids",
        note: "migrateToV6"
      })
    );
    checks.push(
      checkColumn(db, {
        version: "V7",
        table: "salon_services",
        column: "hint",
        note: "migrateToV7"
      })
    );

    // V8 — no dedicated ALTER; only applySchema
    checks.push({
      version: "V8",
      label: "(بدون ALTER اختصاصی)",
      note: "migrateToV8 فقط applySchema",
      ok: true,
      detail: "گام ساختاری جداگانه‌ای تعریف نشده"
    });

    // V9
    checks.push(
      checkColumn(db, {
        version: "V9",
        table: "salon_bookings",
        column: "client_user_id",
        note: "migrateToV9"
      })
    );

    // Print column/table checks
    let missing = 0;
    for (const item of checks) {
      const line = `${mark(item.ok)}  [${item.version}] ${item.label}${item.note ? ` — ${item.note}` : ""}`;
      console.log(line);
      console.log(`         ${item.detail}`);
      if (!item.ok) missing += 1;
    }

    console.log("");
    console.log("--- V10) sessions.expires_at باید epoch عددی باشد ---");

    const sessionsOk = tableExists(db, "sessions");
    if (!sessionsOk) {
      console.log("✗ غایب  جدول sessions وجود ندارد");
      missing += 1;
    } else if (!columnExists(db, "sessions", "expires_at")) {
      console.log("✗ غایب  sessions.expires_at وجود ندارد");
      missing += 1;
    } else {
      const rows = db.prepare("SELECT token, expires_at FROM sessions").all();
      const total = rows.length;
      const buckets = { epoch: 0, iso: 0, sqlite_datetime: 0, empty: 0, other: 0 };
      const badSamples = [];
      for (const row of rows) {
        const kind = classifyExpiry(row.expires_at);
        buckets[kind] += 1;
        if (kind !== "epoch" && badSamples.length < 5) {
          badSamples.push({ token: String(row.token).slice(0, 12) + "…", expires_at: row.expires_at, kind });
        }
      }
      const nonEpoch = total - buckets.epoch;
      const v10Ok = total === 0 || nonEpoch === 0;
      console.log(`${mark(v10Ok)}  sessions.expires_at به‌صورت epoch`);
      console.log(`         کل ردیف‌ها: ${total}`);
      console.log(`         epoch عددی: ${buckets.epoch}`);
      console.log(`         ISO string: ${buckets.iso}`);
      console.log(`         SQLite datetime: ${buckets.sqlite_datetime}`);
      console.log(`         خالی: ${buckets.empty}`);
      console.log(`         سایر: ${buckets.other}`);
      if (nonEpoch > 0) {
        console.log(`         ✗ ${nonEpoch} ردیف هنوز رشته‌ای/غیرepoch هستند (تحت تأثیر V10)`);
        for (const sample of badSamples) {
          console.log(`           نمونه [${sample.kind}]: ${sample.expires_at}`);
        }
        missing += 1;
      } else if (total === 0) {
        console.log("         جدول خالی است — فرمت ردیف برای بررسی نمونه وجود ندارد (از نظر ستون سالم تلقی می‌شود)");
      }
    }

    console.log("");
    console.log("--- 3) جمع‌بندی ---");
    const versionMismatch =
      reportedVersion == null || reportedVersion !== TARGET_SCHEMA_VERSION;
    if (missing === 0 && !versionMismatch) {
      console.log("وضعیت: سالم");
      console.log(
        `schema_version=${reportedVersion} و تمام ستون‌ها/تبدیل‌های V3–V10 روی این فایل موجودند.`
      );
      console.log("نیاز به migration ترمیمی (repair) نیست.");
    } else if (missing === 0 && versionMismatch) {
      console.log("وضعیت: ناسازگاری meta");
      console.log(
        `ساختار V3–V10 کامل به نظر می‌رسد، ولی schema_version گزارش‌شده (${reportedVersion}) با TARGET (${TARGET_SCHEMA_VERSION}) یکی نیست.`
      );
      console.log("پیشنهاد: در گام بعد فقط meta را هم‌تراز کنید یا علت stamp اشتباه را بررسی کنید.");
      process.exitCode = 1;
    } else {
      console.log("وضعیت: نیاز به migration ترمیمی (repair)");
      console.log(
        `${missing} مورد غایب/ناقص پیدا شد` +
          (versionMismatch
            ? `؛ schema_version گزارش‌شده=${reportedVersion} (TARGET=${TARGET_SCHEMA_VERSION})`
            : `؛ schema_version=${reportedVersion} ولی ساختار ناقص است (احتمالاً stamp پرشی runner قدیمی)`)
      );
      console.log("در این گام چیزی تغییر داده نشد — فقط گزارش.");
      process.exitCode = 1;
    }
  } finally {
    db.close();
  }
}

main();

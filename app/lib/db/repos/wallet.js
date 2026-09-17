import { getDb, withTransaction } from "../connection.js";

export const WALLET_LIMITS = {
  minWithdraw: 100_000,
  autoPayMax: 5_000_000,
  withdrawFeeFlat: 0,
  platformFeePercent: 10
};

function ensureWalletRow(db, userId) {
  const row = db.prepare("SELECT * FROM wallets WHERE user_id = ?").get(userId);
  if (row) return row;
  db.prepare(`
    INSERT INTO wallets (user_id, available_balance, pending_balance)
    VALUES (?, 0, 0)
  `).run(userId);
  return db.prepare("SELECT * FROM wallets WHERE user_id = ?").get(userId);
}

function mapTransaction(row) {
  return {
    id: row.id,
    amount: Number(row.amount || 0),
    currency: row.currency || "shell",
    type: row.type || "adjustment",
    status: row.status || "posted",
    note: row.note || "",
    refType: row.ref_type || "",
    refId: row.ref_id || "",
    balanceAfter: Number(row.balance_after || 0),
    created_at: row.created_at
  };
}

function mapWithdrawal(row) {
  return {
    id: row.id,
    amount: Number(row.amount || 0),
    fee: Number(row.fee || 0),
    netAmount: Number(row.net_amount || 0),
    sheba: row.sheba || "",
    holderName: row.holder_name || "",
    status: row.status || "pending",
    note: row.note || "",
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function mapBankAccount(row) {
  if (!row) return null;
  return {
    sheba: row.sheba || "",
    holderName: row.holder_name || "",
    bankName: row.bank_name || "",
    verified: Boolean(row.verified)
  };
}

function insertLedger(db, {
  userId,
  amount,
  currency,
  type,
  note = "",
  status = "posted",
  refType = "",
  refId = "",
  balanceAfter = 0
}) {
  db.prepare(`
    INSERT INTO wallet_transactions
      (user_id, amount, currency, type, status, note, ref_type, ref_id, balance_after)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    userId,
    Number(amount || 0),
    currency,
    type,
    status,
    note || "",
    refType || "",
    refId || "",
    Number(balanceAfter || 0)
  );
}

/**
 * Server-side idempotency for wallet mutations: a client-supplied key lets a
 * retried/duplicated request (network retry, a double-submit that slips past
 * the client busy-gate, two parallel POSTs) return the first call's result
 * instead of re-applying its effect. Callers must read/write this from
 * inside the SAME withTransaction() as the mutation itself — SQLite
 * serializes writers via BEGIN IMMEDIATE, so a truly concurrent duplicate
 * blocks until the first transaction commits, then sees the stored row here.
 */
function readIdempotentResult(db, userId, kind, key) {
  if (!key) return undefined;
  const row = db.prepare(
    "SELECT response_json FROM wallet_idempotency_keys WHERE user_id = ? AND kind = ? AND key = ?"
  ).get(userId, kind, key);
  if (!row) return undefined;
  try {
    return JSON.parse(row.response_json);
  } catch {
    return undefined;
  }
}

function storeIdempotentResult(db, userId, kind, key, result) {
  if (!key) return;
  db.prepare(`
    INSERT INTO wallet_idempotency_keys (user_id, kind, key, response_json)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id, kind, key) DO NOTHING
  `).run(userId, kind, key, JSON.stringify(result));
}

function readBalanceAfter(db, userId, field) {
  const allowed = {
    available_balance: "available_balance",
    pending_balance: "pending_balance"
  };
  const column = allowed[field];
  if (!column) throw new Error(`invalid balance field: ${field}`);
  const row = db.prepare(`SELECT ${column} AS value FROM wallets WHERE user_id = ?`).get(userId);
  return Number(row?.value || 0);
}

export function getWallet(userId) {
  const db = getDb();
  const row = ensureWalletRow(db, userId);
  const transactions = db.prepare(`
    SELECT * FROM wallet_transactions
    WHERE user_id = ?
    ORDER BY id DESC
    LIMIT 80
  `).all(userId).map(mapTransaction);

  const withdrawals = db.prepare(`
    SELECT * FROM wallet_withdrawals
    WHERE user_id = ?
    ORDER BY id DESC
    LIMIT 40
  `).all(userId).map(mapWithdrawal);

  const bank = db.prepare("SELECT * FROM wallet_bank_accounts WHERE user_id = ?").get(userId);

  const availableBalance = Number(row?.available_balance || 0);
  const pendingBalance = Number(row?.pending_balance || 0);

  return {
    availableBalance,
    pendingBalance,
    totalBalance: availableBalance + pendingBalance,
    bankAccount: mapBankAccount(bank),
    transactions,
    withdrawals,
    limits: { ...WALLET_LIMITS }
  };
}

export function creditCash(userId, {
  amount,
  asPending = false,
  note = "",
  type = "booking_earn",
  feePercent = WALLET_LIMITS.platformFeePercent,
  refType = "",
  refId = "",
  idempotencyKey = ""
} = {}) {
  const gross = Math.max(0, Math.floor(Number(amount || 0)));
  if (!gross) {
    return { ok: false, error: "invalid_amount" };
  }

  const safeFeePercent = Math.max(0, Number(feePercent ?? WALLET_LIMITS.platformFeePercent) || 0);
  const fee = Math.floor((gross * safeFeePercent) / 100);
  const net = Math.max(0, gross - fee);
  const db = getDb();
  ensureWalletRow(db, userId);
  const feeNote = fee > 0 ? ` · کارمزد ${safeFeePercent}٪: ${fee.toLocaleString("en-US")} تومان` : "";
  const key = String(idempotencyKey || "").trim();

  try {
    const core = withTransaction(db, () => {
      const existing = readIdempotentResult(db, userId, "demo_credit", key);
      if (existing) return existing;

      if (asPending) {
        const info = db.prepare(`
          UPDATE wallets
          SET pending_balance = pending_balance + ?, updated_at = CURRENT_TIMESTAMP
          WHERE user_id = ?
        `).run(net, userId);
        if (!info.changes) {
          throw new Error("wallet_missing");
        }
        insertLedger(db, {
          userId,
          amount: net,
          currency: "toman",
          type,
          note: `${note || "درآمد رزرو (در انتظار آزادسازی)"}${feeNote}`,
          refType,
          refId,
          balanceAfter: readBalanceAfter(db, userId, "available_balance")
        });
      } else {
        const info = db.prepare(`
          UPDATE wallets
          SET available_balance = available_balance + ?, updated_at = CURRENT_TIMESTAMP
          WHERE user_id = ?
        `).run(net, userId);
        if (!info.changes) {
          throw new Error("wallet_missing");
        }
        const available = readBalanceAfter(db, userId, "available_balance");
        insertLedger(db, {
          userId,
          amount: net,
          currency: "toman",
          type,
          note: `${note || "واریز به موجودی قابل‌برداشت"}${feeNote}`,
          refType,
          refId,
          balanceAfter: available
        });
      }

      const result = { ok: true, net, fee, feePercent: safeFeePercent };
      storeIdempotentResult(db, userId, "demo_credit", key, result);
      return result;
    });
    return { ...core, ...getWallet(userId) };
  } catch (error) {
    return { ok: false, error: "transaction_failed", detail: String(error?.message || error) };
  }
}

export function releasePending(userId, amount = null, note = "آزادسازی موجودی در انتظار") {
  const db = getDb();
  ensureWalletRow(db, userId);
  const moveRequested = amount == null
    ? null
    : Math.max(0, Math.floor(Number(amount)));

  if (moveRequested === 0) {
    return { ok: false, error: "nothing_to_release" };
  }

  try {
    const result = withTransaction(db, () => {
      const current = db.prepare(
        "SELECT pending_balance, available_balance FROM wallets WHERE user_id = ?"
      ).get(userId);
      const pending = Number(current?.pending_balance || 0);
      const move = moveRequested == null ? pending : Math.min(pending, moveRequested);
      if (!move) {
        return { ok: false, error: "nothing_to_release" };
      }

      const info = db.prepare(`
        UPDATE wallets
        SET pending_balance = pending_balance - ?,
            available_balance = available_balance + ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ?
          AND pending_balance >= ?
          AND pending_balance - ? >= 0
      `).run(move, move, userId, move, move);

      if (!info.changes) {
        return { ok: false, error: "insufficient_pending" };
      }

      const nextAvailable = readBalanceAfter(db, userId, "available_balance");
      insertLedger(db, {
        userId,
        amount: move,
        currency: "toman",
        type: "release",
        note,
        balanceAfter: nextAvailable
      });
      return { ok: true, moved: move };
    });

    if (!result.ok) return result;
    return { ok: true, moved: result.moved, ...getWallet(userId) };
  } catch (error) {
    return { ok: false, error: "transaction_failed", detail: String(error?.message || error) };
  }
}

export function normalizeSheba(value) {
  const raw = String(value || "").trim().toUpperCase().replace(/[\s-]/g, "");
  if (!raw) return "";
  const withIR = raw.startsWith("IR") ? raw : `IR${raw}`;
  return withIR;
}

export function isValidSheba(sheba) {
  const value = normalizeSheba(sheba);
  return /^IR\d{24}$/.test(value);
}

export function saveBankAccount(userId, { sheba, holderName, bankName = "" } = {}) {
  const normalized = normalizeSheba(sheba);
  const holder = String(holderName || "").trim();
  if (!isValidSheba(normalized)) {
    return { ok: false, error: "invalid_sheba" };
  }
  if (holder.length < 3) {
    return { ok: false, error: "invalid_holder" };
  }

  const db = getDb();
  ensureWalletRow(db, userId);
  db.prepare(`
    INSERT INTO wallet_bank_accounts (user_id, sheba, holder_name, bank_name, verified, updated_at)
    VALUES (?, ?, ?, ?, 0, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id) DO UPDATE SET
      sheba = excluded.sheba,
      holder_name = excluded.holder_name,
      bank_name = excluded.bank_name,
      verified = 0,
      updated_at = CURRENT_TIMESTAMP
  `).run(userId, normalized, holder, String(bankName || "").trim());

  return { ok: true, ...getWallet(userId) };
}

export function requestWithdraw(userId, amountInput, note = "", idempotencyKey = "") {
  const amount = Math.floor(Number(amountInput || 0));
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: "invalid_amount" };
  }
  if (amount < WALLET_LIMITS.minWithdraw) {
    return { ok: false, error: "below_minimum", minWithdraw: WALLET_LIMITS.minWithdraw };
  }

  const db = getDb();
  ensureWalletRow(db, userId);

  const bank = db.prepare("SELECT * FROM wallet_bank_accounts WHERE user_id = ?").get(userId);
  if (!bank?.sheba || !isValidSheba(bank.sheba)) {
    return { ok: false, error: "bank_required" };
  }

  const fee = WALLET_LIMITS.withdrawFeeFlat;
  const net = Math.max(0, amount - fee);
  if (!net) {
    return { ok: false, error: "invalid_amount" };
  }
  const key = String(idempotencyKey || "").trim();

  try {
    const result = withTransaction(db, () => {
      const existing = readIdempotentResult(db, userId, "withdraw", key);
      if (existing) return existing;

      const info = db.prepare(`
        UPDATE wallets
        SET available_balance = available_balance - ?, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ? AND available_balance >= ? AND available_balance - ? >= 0
      `).run(amount, userId, amount, amount);

      if (!info.changes) {
        return { ok: false, error: "insufficient" };
      }

      const nextAvailable = readBalanceAfter(db, userId, "available_balance");
      const insertInfo = db.prepare(`
        INSERT INTO wallet_withdrawals
          (user_id, amount, fee, net_amount, sheba, holder_name, status, note)
        VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)
      `).run(
        userId,
        amount,
        fee,
        net,
        bank.sheba,
        bank.holder_name || "",
        note || "برداشت در انتظار تایید"
      );
      const withdrawalId = Number(insertInfo.lastInsertRowid);

      insertLedger(db, {
        userId,
        amount: -amount,
        currency: "toman",
        type: "withdraw",
        status: "pending",
        note: note || `درخواست برداشت ${amount.toLocaleString("en-US")} تومان`,
        refType: "withdrawal",
        refId: String(withdrawalId),
        balanceAfter: nextAvailable
      });

      if (fee > 0) {
        insertLedger(db, {
          userId,
          amount: -fee,
          currency: "toman",
          type: "withdraw_fee",
          note: "کارمزد برداشت",
          refType: "withdrawal",
          refId: String(withdrawalId),
          balanceAfter: nextAvailable
        });
      }

      const core = { ok: true, withdrawalId, nextAvailable };
      storeIdempotentResult(db, userId, "withdraw", key, core);
      return core;
    });

    if (!result.ok) return result;
    return {
      ok: true,
      autoPay: false,
      status: "pending",
      withdrawalId: result.withdrawalId,
      ...getWallet(userId)
    };
  } catch (error) {
    return { ok: false, error: "transaction_failed", detail: String(error?.message || error) };
  }
}

/**
 * Admin confirmation: pending/processing → paid.
 * Balance was already deducted at requestWithdraw time.
 */
export function confirmWithdraw(withdrawalId, { note = "" } = {}) {
  const id = Number(withdrawalId);
  if (!Number.isFinite(id) || id <= 0) {
    return { ok: false, error: "invalid_id" };
  }

  const db = getDb();
  try {
    const result = withTransaction(db, () => {
      const row = db.prepare("SELECT * FROM wallet_withdrawals WHERE id = ?").get(id);
      if (!row) return { ok: false, error: "not_found" };
      if (row.status === "paid") return { ok: false, error: "already_paid" };
      if (row.status === "rejected" || row.status === "failed") {
        return { ok: false, error: "not_confirmable" };
      }
      if (row.status !== "pending" && row.status !== "processing") {
        return { ok: false, error: "not_confirmable" };
      }

      const confirmNote = note || "برداشت توسط ادمین تایید و پرداخت شد.";
      db.prepare(`
        UPDATE wallet_withdrawals
        SET status = 'paid', note = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND status IN ('pending', 'processing')
      `).run(confirmNote, id);

      const available = readBalanceAfter(db, row.user_id, "available_balance");
      insertLedger(db, {
        userId: row.user_id,
        amount: 0,
        currency: "toman",
        type: "withdraw_paid",
        note: `برداشت #${id} پرداخت شد`,
        refType: "withdrawal",
        refId: String(id),
        balanceAfter: available
      });

      return { ok: true, userId: row.user_id, withdrawalId: id };
    });

    if (!result.ok) return result;
    return { ok: true, withdrawalId: result.withdrawalId, ...getWallet(result.userId) };
  } catch (error) {
    return { ok: false, error: "transaction_failed", detail: String(error?.message || error) };
  }
}

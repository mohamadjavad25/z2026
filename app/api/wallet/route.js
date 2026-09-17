import { NextResponse } from "next/server";
import { requireUser } from "../../lib/http.js";
import { ensureDb } from "../../lib/db/connection.js";
import * as wallet from "../../lib/db/repos/wallet.js";
import { getWalletAdminToken, isDemoCreditBlocked } from "../../lib/wallet-guards.js";

export const runtime = "nodejs";

function cashRoles(type) {
  return type === "artist" || type === "salon" || type === "shop";
}

function adminTokenFromRequest(request, body = {}) {
  const header =
    request.headers.get("x-wallet-admin-token")
    || (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  const fromBody = String(body.adminToken || body.admin_token || "").trim();
  return header || fromBody;
}

function requireWalletAdmin(request, body = {}) {
  const expected = getWalletAdminToken();
  if (!expected) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "تایید برداشت پیکربندی نشده است (ZIBABAN_WALLET_ADMIN_TOKEN)." },
        { status: 503 }
      )
    };
  }
  const provided = adminTokenFromRequest(request, body);
  if (!provided || provided !== expected) {
    return {
      ok: false,
      response: NextResponse.json({ error: "دسترسی ادمین کیف‌پول مجاز نیست." }, { status: 403 })
    };
  }
  return { ok: true };
}

export async function GET(request) {
  ensureDb();
  const auth = requireUser(request);
  if (!auth.ok) return auth.response;
  const data = wallet.getWallet(auth.user.id);
  return NextResponse.json({ ...data, data });
}

export async function POST(request) {
  ensureDb();
  const auth = requireUser(request);
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({}));
  const kind = String(body.kind || body.action || "").trim();

  if (kind === "bank") {
    if (!cashRoles(auth.user.type)) {
      return NextResponse.json({ error: "فقط آرتیست، سالن و فروشگاه می‌توانند حساب بانکی ثبت کنند." }, { status: 403 });
    }
    const result = wallet.saveBankAccount(auth.user.id, {
      sheba: body.sheba,
      holderName: body.holderName || body.holder_name,
      bankName: body.bankName || body.bank_name
    });
    if (!result.ok) {
      const message =
        result.error === "invalid_sheba"
          ? "شبا معتبر نیست. باید با IR و ۲۴ رقم باشد."
          : result.error === "invalid_holder"
            ? "نام صاحب حساب را کامل وارد کن."
            : "ثبت حساب بانکی انجام نشد.";
      return NextResponse.json({ error: message }, { status: 400 });
    }
    return NextResponse.json({ ...result, data: result });
  }

  if (kind === "withdraw") {
    if (!cashRoles(auth.user.type)) {
      return NextResponse.json({ error: "برداشت فقط برای آرتیست، سالن و فروشگاه فعال است." }, { status: 403 });
    }
    const result = wallet.requestWithdraw(auth.user.id, body.amount, body.note || "", body.idempotencyKey || "");
    if (!result.ok) {
      const message =
        result.error === "below_minimum"
          ? `حداقل برداشت ${Number(result.minWithdraw || wallet.WALLET_LIMITS.minWithdraw).toLocaleString("en-US")} تومان است.`
          : result.error === "insufficient"
            ? "موجودی قابل‌برداشت کافی نیست."
            : result.error === "bank_required"
              ? "اول شبا و نام صاحب حساب را ثبت کن."
              : "درخواست برداشت ثبت نشد.";
      return NextResponse.json({ error: message }, { status: 400 });
    }
    return NextResponse.json({
      ...result,
      message: "برداشت ثبت شد و در وضعیت pending منتظر تایید ادمین است.",
      data: result
    });
  }

  if (kind === "confirm_withdraw") {
    const admin = requireWalletAdmin(request, body);
    if (!admin.ok) return admin.response;
    const result = wallet.confirmWithdraw(body.withdrawalId || body.id, {
      note: body.note || ""
    });
    if (!result.ok) {
      const message =
        result.error === "not_found"
          ? "درخواست برداشت یافت نشد."
          : result.error === "already_paid"
            ? "این برداشت قبلاً پرداخت شده است."
            : result.error === "not_confirmable"
              ? "این برداشت قابل تایید نیست."
              : "تایید برداشت انجام نشد.";
      return NextResponse.json({ error: message }, { status: 400 });
    }
    return NextResponse.json({
      ...result,
      message: "برداشت تایید و به وضعیت paid منتقل شد.",
      data: result
    });
  }

  if (kind === "demo_credit") {
    if (isDemoCreditBlocked()) {
      return NextResponse.json(
        { error: "شارژ تستی در محیط production غیرفعال است." },
        { status: 403 }
      );
    }
    if (!cashRoles(auth.user.type)) {
      return NextResponse.json({ error: "این عملیات برای نقش شما فعال نیست." }, { status: 403 });
    }
    const amount = Math.floor(Number(body.amount || 0));
    if (amount < 50_000 || amount > 20_000_000) {
      return NextResponse.json({ error: "مبلغ تست باید بین ۵۰٬۰۰۰ تا ۲۰٬۰۰۰٬۰۰۰ تومان باشد." }, { status: 400 });
    }
    const asPending = Boolean(body.asPending);
    // feePercent from body is intentionally ignored — server constant only.
    const result = wallet.creditCash(auth.user.id, {
      amount,
      asPending,
      feePercent: wallet.WALLET_LIMITS.platformFeePercent,
      type: asPending ? "booking_earn" : "demo_credit",
      note: asPending
        ? "درآمد تستی رزرو (در انتظار آزادسازی)"
        : "شارژ تستی موجودی قابل‌برداشت",
      idempotencyKey: body.idempotencyKey || ""
    });
    if (!result.ok) {
      return NextResponse.json({ error: "شارژ تستی انجام نشد." }, { status: 400 });
    }
    return NextResponse.json({ ...result, data: result });
  }

  if (kind === "release_pending") {
    if (!cashRoles(auth.user.type)) {
      return NextResponse.json({ error: "این عملیات برای نقش شما فعال نیست." }, { status: 403 });
    }
    const result = wallet.releasePending(auth.user.id, body.amount ?? null);
    if (!result.ok) {
      return NextResponse.json({ error: "موجودی در انتظاری برای آزادسازی نیست." }, { status: 400 });
    }
    return NextResponse.json({ ...result, data: result });
  }

  return NextResponse.json({ error: "درخواست نامعتبر است." }, { status: 400 });
}

import { json, readObjectBody, withErrorHandling } from "../../lib/http.js";
import { requireTeamPair } from "../../lib/teamPair.js";
import { answerSettlement, ledger, setLineAmount, startSettlement } from "../../lib/db/repos/teamAgreements.js";
import { notifyConnection } from "../../lib/connectionNotify.js";
import { toPersianDigits } from "../../shared/lib/digits.js";

export const runtime = "nodejs";

const money = (value) => `${toPersianDigits(Number(value).toLocaleString("en-US").replace(/,/g, "٬"))} تومان`;
const otherSide = (pair) => (pair.side === "salon" ? pair.artistUserId : pair.salonUserId);

const REFUSALS = {
  INVALID: [400, "مبلغ درست نیست؛ یه عدد بزن."],
  NOT_FOUND: [404, "این مورد رو پیدا نکردیم؛ صفحه رو تازه کردیم."],
  CLOSED: [409, "این تصفیه همین الان جواب گرفت؛ صفحه رو تازه کردیم."],
  FORBIDDEN: [403, "این تصفیه رو خودت شروع کردی؛ جوابش با طرف مقابله."],
  WAITING: [409, "یه تصفیه منتظر جواب طرف مقابله؛ اول اون تموم شه."],
  EMPTY: [409, "هنوز کاری نیست که تصفیه بشه."],
  NO_SHARE: [409, "برای چند کار درصد مشخص نیست. اول توی شرایط کار درصد رو بذارین."]
};
const refuse = (code) => {
  const [status, message] = REFUSALS[code] || REFUSALS.NOT_FOUND;
  return json({ error: message, code }, { status });
};

/** GET /api/team-ledger?salonUserId=… (artist) | artistUserId=… (salon) → the open lines, their totals, a settlement waiting for an answer and the closed ones. */
async function _GET(request) {
  const pair = await requireTeamPair(request, Object.fromEntries(new URL(request.url).searchParams));
  if (!pair.ok) return pair.response;
  return json({ data: { side: pair.side, ...(await ledger(pair.salonUserId, pair.artistUserId)) } });
}

/**
 * PATCH /api/team-ledger { …pair, line, amount } (the salon only) → changes the price of one open line.
 * POST /api/team-ledger { …pair, action: "start", paid } → «تصفیه کردیم» with the amount paid;
 *      { …pair, action: "confirm" | "dispute" | "cancel", id, amount? } → the answer (confirm / another amount) or taking it back.
 * Nothing here moves money; it only records what the two sides say (owner's decision 2026-10-28).
 */
async function _PATCH(request) {
  const body = await readObjectBody(request);
  const pair = await requireTeamPair(request, body);
  if (!pair.ok) return pair.response;
  if (pair.side !== "salon") return json({ error: "قیمت یه کار رو فقط سالن عوض می‌کنه." }, { status: 403 });
  const result = await setLineAmount({ salonUserId: pair.salonUserId, artistUserId: pair.artistUserId, id: Number(body.line), amount: body.amount });
  if (!result.ok) return refuse(result.code);
  notifyConnection(pair.artistUserId, { title: "سالن قیمت یه کار رو عوض کرد", body: `${pair.user.name || "سالن"} قیمت «${result.line.service}» رو شد ${money(result.line.amount)}. توی حساب ببین.`, url: "/" });
  return json({ data: { side: pair.side, ...(await ledger(pair.salonUserId, pair.artistUserId)) } });
}

async function _POST(request) {
  const body = await readObjectBody(request);
  const pair = await requireTeamPair(request, body);
  if (!pair.ok) return pair.response;
  const ids = { salonUserId: pair.salonUserId, artistUserId: pair.artistUserId };
  if (body.action === "start") {
    const result = await startSettlement({ ...ids, side: pair.side, paid: body.paid });
    if (!result.ok) return refuse(result.code);
    notifyConnection(otherSide(pair), { title: "یه تصفیه منتظر تأیید توئه", body: `${pair.user.name || "طرف همکارت"} می‌گه ${money(result.settlement.paid)} پرداخت شد. ببین و تأیید کن.`, url: "/" });
  } else if (["confirm", "dispute", "cancel"].includes(body.action)) {
    const result = await answerSettlement({ ...ids, id: Number(body.id), side: pair.side, action: body.action, amount: body.amount });
    if (!result.ok) return refuse(result.code);
    if (body.action === "confirm") notifyConnection(otherSide(pair), { title: "تصفیه تأیید شد", body: `${pair.user.name || "طرف همکارت"} تصفیه رو تأیید کرد.`, url: "/" });
    if (body.action === "dispute") notifyConnection(otherSide(pair), { title: "مبلغ تصفیه فرق داره", body: `${pair.user.name || "طرف همکارت"} می‌گه ${money(result.settlement.otherAmount)}. با هم صحبت کنین.`, url: "/" });
  } else {
    return json({ error: "درخواست درست نرسید؛ دوباره بزن." }, { status: 400 });
  }
  return json({ data: { side: pair.side, ...(await ledger(pair.salonUserId, pair.artistUserId)) } });
}

export const GET = withErrorHandling(_GET);
export const PATCH = withErrorHandling(_PATCH);
export const POST = withErrorHandling(_POST);

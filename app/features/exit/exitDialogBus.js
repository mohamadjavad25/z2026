/**
 * One dialog for "you can't just leave while confirmed bookings are waiting" (owner's rules of 2026-10-22): leaving a
 * team, removing a team member. The place that tried to leave opens it with what the server answered and a `retry` that
 * repeats the same action (with `cancelAll` when the person chose «لغو همهٔ نوبت‌ها و ارسال پیامک»).
 * detail: { scope, params, plan, message, title, confirmLabel, retry({ cancelAll }) → { ok, message?, plan? } }
 */
let listener = null;

export function openExitDialog(detail) {
  if (listener) listener(detail);
}

export function onExitDialog(fn) {
  listener = fn;
  return () => {
    if (listener === fn) listener = null;
  };
}

/** The 409 of a refused leaving: { code, message, plan } when it is one, else null. */
export function exitRefusalOf(result) {
  const code = result?.payload?.code;
  const plan = result?.payload?.data?.plan;
  if (result?.status === 409 && plan && (code === "NEAR_BOOKINGS" || code === "HAS_BOOKINGS")) {
    return { code, message: result.payload.error || "", plan };
  }
  return null;
}

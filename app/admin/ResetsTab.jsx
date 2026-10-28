"use client";

import { useState } from "react";
import { KeyRound, UserRound, Wand2 } from "lucide-react";
import { Button } from "../components/ui";
import { api } from "./adminFetch";
import { ago, fmtDate } from "./format";
import { PageHead } from "./PageHead";
import { makePassword } from "./UserDetail";
import { CopyButton, EmptyState, ErrorNote, Loading, toastResult, useAdminData } from "./ui";

/** People who forgot their password: make a new one here and text it to the account's own number (support never phones anyone, owner 2026-10-27). */
export function ResetsTab({ onGo, onChanged }) {
  const { data, error, reload } = useAdminData("/api/auth/password-reset-requests");
  const [passwords, setPasswords] = useState({});
  const [busyId, setBusyId] = useState(null);

  async function resolve(request) {
    const newPassword = String(passwords[request.id] || "");
    setBusyId(request.id);
    const result = await api.post(`/api/auth/password-reset-requests/${request.id}/resolve`, { newPassword });
    setBusyId(null);
    if (toastResult(result, "رمز بازنشانی شد؛ پیامکش آماده است، بفرستش.")) {
      // The request leaves the list once resolved, so the text with the new password opens right away.
      window.location.href = `sms:${request.phone}?body=${encodeURIComponent(`رمز تازهٔ فرفروت: ${newPassword}`)}`;
      reload();
      onChanged?.();
    }
  }

  const requests = data?.requests || [];
  return (
    <>
      <PageHead tab="resets" />
      <section className="admCard">
        <ol className="admSteps">
          <li><i>۱</i><span><b>حسابش را ببین</b><small>با «حسابش» مطمئن شو این شماره واقعاً یک حساب دارد. رمز فقط به همین شماره می‌رود، پس به دست صاحب حساب می‌رسد.</small></span></li>
          <li><i>۲</i><span><b>رمز تازه</b><small>با دکمهٔ «رمز تصادفی» یک رمز بساز.</small></span></li>
          <li><i>۳</i><span><b>پیامک رمز</b><small>«بازنشانی» را بزن؛ پیامک با رمز خودش آماده می‌شود، فقط بفرستش. همهٔ دستگاه‌هایش خارج می‌شوند.</small></span></li>
        </ol>
        <ErrorNote error={error} onRetry={reload} />
        {!data && !error ? <Loading /> : null}
        {data && !requests.length ? <EmptyState icon={KeyRound} title="درخواستی منتظر نیست">هر کس در اپ «فراموشی رمز» را بزند، اینجا می‌آید.</EmptyState> : null}
        {requests.length ? (
          <ul className="admReqs">
            {requests.map((request) => {
              const value = passwords[request.id] || "";
              return (
                <li key={request.id}>
                  <div>
                    <b dir="ltr">{request.phone}</b>
                    <small>{fmtDate(request.created_at)} ({ago(request.created_at)}){request.note ? ` • ${request.note}` : ""}</small>
                    <span className="admReqTools">
                      <button type="button" className="admChipLink" onClick={() => onGo("users", { q: request.phone })}><UserRound size={14} aria-hidden="true" /> حسابش</button>
                    </span>
                  </div>
                  <span className="admReqInput">
                    <input aria-label={`رمز جدید برای ${request.phone}`} type="text" dir="ltr" autoComplete="off" placeholder="رمز جدید (حداقل ۸)" value={value} onChange={(event) => setPasswords({ ...passwords, [request.id]: event.target.value })} />
                    <button type="button" className="admIconBtn" aria-label="رمز تصادفی" title="رمز تصادفی" onClick={() => setPasswords({ ...passwords, [request.id]: makePassword() })}><Wand2 size={15} aria-hidden="true" /></button>
                    {value ? <CopyButton text={value} label="کپی رمز" /> : null}
                  </span>
                  <Button size="sm" disabled={value.length < 8} loading={busyId === request.id} loadingLabel="…" onClick={() => resolve(request)}>بازنشانی</Button>
                </li>
              );
            })}
          </ul>
        ) : null}
      </section>
    </>
  );
}

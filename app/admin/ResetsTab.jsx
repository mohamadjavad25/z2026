"use client";

import { useState } from "react";
import { KeyRound, Phone, UserRound, Wand2 } from "lucide-react";
import { Button } from "../components/ui";
import { api } from "./adminFetch";
import { ago, fmtDate } from "./format";
import { PageHead } from "./PageHead";
import { makePassword } from "./UserDetail";
import { CopyButton, EmptyState, ErrorNote, Loading, toastResult, useAdminData } from "./ui";

/** People who forgot their password: call them, check it is really them, then give them a new one here. */
export function ResetsTab({ onGo, onChanged }) {
  const { data, error, reload } = useAdminData("/api/auth/password-reset-requests");
  const [passwords, setPasswords] = useState({});
  const [busyId, setBusyId] = useState(null);

  async function resolve(request) {
    const newPassword = String(passwords[request.id] || "");
    setBusyId(request.id);
    const result = await api.post(`/api/auth/password-reset-requests/${request.id}/resolve`, { newPassword });
    setBusyId(null);
    if (toastResult(result, "رمز بازنشانی شد؛ رمز جدید را به کاربر بگو.")) {
      reload();
      onChanged?.();
    }
  }

  const requests = data?.requests || [];
  return (
    <>
      <PageHead tab="resets" />
      <section className="admCard">
        <p className="admMuted admLead">۱. با شمارهٔ کاربر تماس بگیر و هویتش را تأیید کن. ۲. یک رمز جدید بساز (دکمهٔ «رمز تصادفی»). ۳. رمز را تلفنی به او بگو؛ همهٔ دستگاه‌هایش خارج می‌شوند.</p>
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
                      <a className="admChipLink" href={`tel:${request.phone}`}><Phone size={14} aria-hidden="true" /> تماس</a>
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

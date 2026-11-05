"use client";

import { MessageSquareHeart, RefreshCw } from "lucide-react";
import { Button } from "../components/ui";
import { FEELS, partsOf } from "../shared/lib/welcomeSurvey";
import { TYPE_LABEL, ago, num } from "./format";
import { PageHead } from "./PageHead";
import { Card, EmptyState, ErrorNote, Loading, useAdminData } from "./ui";

/** Every part's words, whichever role it belongs to. */
const PART_LABEL = new Map(["artist", "salon", "client"].flatMap((role) => partsOf(role)));

/** What people said in the welcome survey: the counts, then each answer with who gave it. */
export function SurveysTab() {
  const { data, error, loading, reload } = useAdminData("/api/admin/welcome-survey", { every: 60 * 1000 });
  const head = (
    <PageHead tab="surveys">
      <Button variant="secondary" size="sm" disabled={loading} onClick={reload}><RefreshCw size={15} aria-hidden="true" /> تازه کن</Button>
    </PageHead>
  );
  if (!data) return <>{head}{error ? <ErrorNote error={error} onRetry={reload} /> : <Loading />}</>;

  const { totals, feels, parts, answers } = data;
  const feelCount = (index) => feels.find((row) => row.feel === index)?.count || 0;

  return (
    <>
      {head}
      <div className="admGrid">
        <div className="admStat"><small>جواب دادن</small><strong>{num(totals.answered)}</strong></div>
        <div className="admStat"><small>گفتن بعداً</small><strong>{num(totals.put_off)}</strong></div>
        <div className="admStat"><small>اعلان گرفتن</small><strong>{num(totals.pushed)}</strong></div>
      </div>
      {answers.length ? (
        <>
          <Card title="کار با فرفرو چطور بود؟" icon={MessageSquareHeart}>
            <ul className="admErrors">
              {FEELS.map((label, index) => <li key={label}><strong>{label}</strong> <span className="admMuted">{num(feelCount(index))} نفر</span></li>)}
            </ul>
          </Card>
          <Card title="کجاش سخت بود؟">
            <ul className="admErrors">
              {parts.map((row) => <li key={row.part}><strong>{PART_LABEL.get(row.part) || row.part}</strong> <span className="admMuted">{num(row.count)} نفر</span></li>)}
            </ul>
          </Card>
          <Card title="جواب‌ها">
            <ul className="admErrors">
              {answers.map((answer) => (
                <li key={answer.user_id}>
                  <strong>{answer.name || "بی‌نام"}</strong> <span className="admMuted">{TYPE_LABEL[answer.type] || answer.type} • شماره {num(answer.user_id)} • {ago(answer.answered_at)}</span>
                  <p>{FEELS[answer.feel]}{answer.parts.length ? ` • ${answer.parts.map((part) => PART_LABEL.get(part) || part).join("، ")}` : ""}</p>
                  {answer.idea ? <p>{answer.idea}</p> : null}
                </li>
              ))}
            </ul>
          </Card>
        </>
      ) : <EmptyState icon={MessageSquareHeart} title="هنوز کسی جواب نداده">جواب‌ها اینجا میان.</EmptyState>}
    </>
  );
}

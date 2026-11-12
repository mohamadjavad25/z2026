import { notFound } from "next/navigation";
import { ensureDb } from "../../lib/db/connection.js";
import { requestsForCode } from "../../lib/db/repos/contactRequests.js";
import { bookingWhen } from "../../lib/bookingSms.js";
import { RequestLinkClient } from "./RequestLinkClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata = {
  title: "درخواست نوبت | frfro",
  robots: { index: false, follow: false }
};

/**
 * frfro.ir/r/<code>, the link in the SMS a salon or artist gets when a client asks them from the phone's contacts
 * before they are on frfro (owner, 2026-11-12). It shows every request waiting for that number (client's name,
 * service, day and time), then one way in: sign up or log in, and the requests are in the account.
 */
export default async function RequestLinkPage({ params }) {
  const { code } = await params;
  await ensureDb();
  const found = await requestsForCode(String(code || ""));
  if (!found) notFound();
  const requests = found.requests.map((row) => ({
    id: Number(row.id),
    client: row.client_name || "یه مشتری",
    service: row.service,
    serviceEmoji: row.service_emoji || "",
    when: bookingWhen(row.booking_date, row.time)
  }));
  return <RequestLinkClient code={String(code)} requests={requests} delivered={found.delivered} />;
}

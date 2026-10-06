import { toPersianDigits } from "../shared/lib/digits";

export const TYPE_LABEL = { client: "مشتری", artist: "آرتیست", salon: "سالن" };
export const PAGE = 25;

export const fmtDate = (value) => (value ? toPersianDigits(new Intl.DateTimeFormat("fa-IR-u-nu-latn", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Tehran" }).format(new Date(value))) : "—");
export const num = (value) => toPersianDigits(Number(value || 0).toLocaleString("en-US").replace(/,/g, "٬"));

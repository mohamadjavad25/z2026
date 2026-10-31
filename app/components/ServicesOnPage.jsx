"use client";

import { ChevronLeft } from "lucide-react";
import { ServiceIcon } from "./ServiceIcon";
import { formatTomanNumber, parseTomanAmount } from "../shared/lib/money";

/**
 * «خدمات و قیمت‌ها» on a public salon/artist page, for a salon or artist visiting it (they have no «رزرو» bar).
 * Clients see the services only from the bottom bar's menu, so they are not listed twice (user's decision
 * 2026-10-26). Without `onPick` the rows are just shown.
 */
export function ServicesOnPage({ services = [], onPick }) {
  if (!services.length) return null;
  const Row = onPick ? "button" : "div";
  return (
    <section className="spvSection sopSection" aria-labelledby="spv-services-title">
      <h3 className="spvHead" id="spv-services-title">خدمات و قیمت‌ها</h3>
      <div className="sopList">
        {services.map((service) => {
          const amount = parseTomanAmount(service.price);
          return (
            <Row
              {...(onPick ? { type: "button", onClick: () => onPick(service), "aria-label": `رزرو ${service.name}` } : {})}
              key={service.id ?? service.name}
              className={`sopRow${onPick ? "" : " is-static"}`}
            >
              <ServiceIcon emoji={service.emoji} name={service.name} size="sm" />
              <span className="sopBody">
                <b>{service.name}</b>
                <small>{service.duration || "مدتش فرق می‌کنه"}</small>
              </span>
              <span className="sopPrice">
                {amount ? <>{formatTomanNumber(amount)} <small>تومان</small></> : <small>قیمت توافقی</small>}
              </span>
              {onPick ? <ChevronLeft size={18} className="sopGo" aria-hidden="true" /> : null}
            </Row>
          );
        })}
      </div>
    </section>
  );
}

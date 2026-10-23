"use client";

import { ChevronLeft } from "lucide-react";
import { ServiceIcon } from "./ServiceIcon";
import { formatTomanNumber, parseTomanAmount } from "../shared/lib/money";

/**
 * «خدمات و قیمت‌ها» on a public salon/artist page: every service with its time and price, right on the
 * page (user's choice 2026-10-23), so the client sees what is offered without opening anything.
 * Tapping one starts a booking with it; more services can be added on the time screen.
 */
export function ServicesOnPage({ services = [], onPick }) {
  if (!services.length) return null;
  return (
    <section className="spvSection sopSection" aria-labelledby="spv-services-title">
      <h3 className="spvHead" id="spv-services-title">خدمات و قیمت‌ها</h3>
      <div className="sopList">
        {services.map((service) => {
          const amount = parseTomanAmount(service.price);
          return (
            <button
              type="button"
              key={service.id ?? service.name}
              className="sopRow"
              onClick={() => onPick?.(service)}
              aria-label={`رزرو ${service.name}`}
            >
              <ServiceIcon emoji={service.emoji} name={service.name} size="sm" />
              <span className="sopBody">
                <b>{service.name}</b>
                <small>{service.duration || "مدتش فرق می‌کنه"}</small>
              </span>
              <span className="sopPrice">
                {amount ? <>{formatTomanNumber(amount)} <small>تومان</small></> : <small>قیمت توافقی</small>}
              </span>
              <ChevronLeft size={18} className="sopGo" aria-hidden="true" />
            </button>
          );
        })}
      </div>
    </section>
  );
}

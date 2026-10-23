"use client";

import { ServiceIcon } from "../../components/ServiceIcon";
import { ServiceIconStrip } from "../../components/ServiceIconStrip";
import { formatTomanNumber, parseTomanAmount } from "../../shared/lib/money";

export function PublicArtistServicesPanel({
  services,
  selectedServiceId,
  onServiceClick,
  onSelectService
}) {
  const safeServices = Array.isArray(services) ? services : [];

  return (
    <section className="artistPublicServices" aria-label="خدمات آرتیست">
      {safeServices.length === 0 ? (
        <div className="artistPublicServiceEmpty" role="status">
          <ServiceIconStrip size="md" />
          <b>هنوز خدمتی نذاشته</b>
          <span>فعلاً خدمتی برای نوبت گرفتن نذاشته؛ بعداً یه سر بزن.</span>
        </div>
      ) : (
        <div className="spvServiceList">
          {safeServices.map((service) => {
            const amount = parseTomanAmount(service.price);
            return (
              <button
                type="button"
                className={`spvService ${selectedServiceId === service.id ? "is-selected" : ""}`}
                key={service.id}
                onClick={() => onServiceClick?.(service)}
              >
                <ServiceIcon emoji={service.emoji} name={service.name} size="md" />
                <span className="spvServiceBody">
                  <b>{service.name}</b>
                  <small>{service.duration || "مدتش فرق می‌کنه"}</small>
                </span>
                <span className="spvServicePrice">
                  {amount ? <><b>{formatTomanNumber(amount)}</b><em>تومان</em></> : <em>قیمت توافقی</em>}
                </span>
                <span className="spvServiceGo">رزرو</span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

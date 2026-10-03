"use client";

import { ChevronLeft, Sparkles, Timer } from "lucide-react";
import { ServiceEmoji } from "../../components/ServiceEmoji";
import { toPersianDigits } from "../../shared/lib/digits";

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
          <img className="artistPublicEmptyImg" src="/artist-services-public-empty.png" alt="" draggable={false} />
          <b>هنوز خدمتی ثبت نشده</b>
          <span>این آرتیست فعلاً خدمتی برای رزرو آنلاین اضافه نکرده؛ بعداً سر بزن.</span>
        </div>
      ) : (
        <div className="artistPublicServiceList">
          {safeServices.map((service, index) => {
            const active = selectedServiceId === service.id;
            return (
              <button
                type="button"
                className={`artistPublicServiceCard ${active ? "is-selected" : ""}`}
                key={service.id}
                style={{ "--service-delay": `${index * 40}ms` }}
                onClick={() => onServiceClick?.(service)}
              >
                <span className="artistPublicServiceIcon" aria-hidden="true">
                  <ServiceEmoji id={service.emoji} name={service.name} size={30} fallback={<Sparkles size={16} />} />
                </span>
                <span className="artistPublicServiceInfo">
                  <strong className="artistPublicServiceTitle">{service.name}</strong>
                  {service.duration ? (
                    <span className="artistPublicServiceMetaLine">
                      <Timer size={12} />
                      {service.duration}
                    </span>
                  ) : null}
                </span>
                <span className="artistPublicServiceSide">
                  <b>{service.price ? `${toPersianDigits(service.price)} تومان` : "توافقی"}</b>
                  <ChevronLeft size={15} aria-hidden="true" />
                </span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

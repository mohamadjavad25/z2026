"use client";

import { ChevronLeft, Timer } from "lucide-react";
import { ServiceIcon } from "../../components/ServiceIcon";
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
        <div className="svcList">
          {safeServices.map((service, index) => {
            const active = selectedServiceId === service.id;
            return (
              <button
                type="button"
                className={`svcCard ${active ? "is-selected" : ""}`}
                key={service.id}
                style={{ "--service-delay": `${index * 40}ms` }}
                onClick={() => onServiceClick?.(service)}
              >
                <ServiceIcon emoji={service.emoji} name={service.name} size="lg" />
                <span className="svcCardBody">
                  <span className="svcCardTitle"><strong>{service.name}</strong></span>
                  {service.hint ? <span className="svcCardHint">{service.hint}</span> : null}
                  {service.duration ? (
                    <span className="svcCardMeta">
                      <span className="svcChip"><Timer size={12} /> {service.duration}</span>
                    </span>
                  ) : null}
                </span>
                <span className="svcCardSide">
                  <b className="svcPrice">{service.price ? `${toPersianDigits(service.price)} تومان` : "توافقی"}</b>
                  <ChevronLeft size={16} className="svcCardChevron" aria-hidden="true" />
                </span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

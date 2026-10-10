"use client";

import { CalendarCheck, Plus, Timer } from "lucide-react";
import { toPersianDigits } from "../../shared/lib/digits";
import { formatTomanNumber, parseTomanAmount } from "../../shared/lib/money";
import { ServiceIcon } from "../../components/ServiceIcon";
import { ServiceIconStrip } from "../../components/ServiceIconStrip";
import { ProfileEmptyState } from "../profile/ProfileEmptyState";

/**
 * Artist owner — services list tab.
 * Presentational: service rows + create/edit callbacks from HomeApp / hook.
 * Tapping a card opens its editor; delete lives inside that editor.
 */
export function ArtistServicesPanel({
  services = [],
  onCreate,
  onEdit
}) {
  return (
    <section className="artistServiceBoard" aria-label="مدیریت خدمات آرتیست">
      <div className="svcToolbar">
        <div>
          <span>خدمات من</span>
          <b>{toPersianDigits(services.length)} خدمت</b>
        </div>
        <button type="button" className="svcAddBtn" onClick={onCreate}>
          <Plus size={16} />
          افزودن خدمت
        </button>
      </div>

      <div className="svcList">
        {services.length === 0 ? (
          <ProfileEmptyState
            className="artistServiceEmpty"
            visual={<ServiceIconStrip />}
            title="هنوز خدمتی ثبت نشده"
            description="اولین خدمت را اضافه کن تا قیمت، مدت‌زمان و رزرو مستقیم برای مشتری روشن شود."
            actionLabel="افزودن اولین خدمت"
            onAction={onCreate}
          />
        ) : (
          services.map((service, index) => (
            <article
              className="svcCard is-editable"
              key={service.id}
              style={{ "--service-delay": `${index * 55}ms` }}
            >
              <button
                type="button"
                className="svcCardOpen"
                aria-label={`ویرایش ${service.name}`}
                onClick={() => onEdit?.(service)}
              />
              <ServiceIcon emoji={service.emoji} name={service.name} size="xl" />
              <div className="svcCardBody">
                <div className="svcCardTitle">
                  <strong>{service.name}</strong>
                  {service.badge ? <em className="svcCardBadge">{service.badge}</em> : null}
                </div>
                {service.hint ? <p className="svcCardHint">{service.hint}</p> : null}
                <div className="svcCardMeta">
                  <span className="svcChip is-price">{service.price ? `${formatTomanNumber(parseTomanAmount(service.price))} تومان` : "توافقی"}</span>
                  <span className="svcChip"><Timer size={12} /> {service.duration}</span>
                  <span className="svcChip"><CalendarCheck size={12} /> قابل رزرو</span>
                </div>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

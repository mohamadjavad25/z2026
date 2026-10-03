"use client";

import { CalendarCheck, Pencil, Plus, Timer, Trash2 } from "lucide-react";
import { toPersianDigits } from "../../shared/lib/digits";
import { ServiceIcon } from "../../components/ServiceIcon";
import { ServiceIconStrip } from "../../components/ServiceIconStrip";
import { ProfileEmptyState } from "../profile/ProfileEmptyState";

/**
 * Artist owner — services list tab.
 * Presentational: service rows + create/edit/delete callbacks from HomeApp / hook.
 */
export function ArtistServicesPanel({
  services = [],
  onCreate,
  onEdit,
  onDelete
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
              className="svcCard"
              key={service.id}
              style={{ "--service-delay": `${index * 55}ms` }}
            >
              <ServiceIcon emoji={service.emoji} name={service.name} size="lg" />
              <div className="svcCardBody">
                <div className="svcCardTitle">
                  <strong>{service.name}</strong>
                  {service.badge ? <em className="svcCardBadge">{service.badge}</em> : null}
                </div>
                {service.hint ? <p className="svcCardHint">{service.hint}</p> : null}
                <div className="svcCardMeta">
                  <span className="svcChip is-price">{service.price ? `${toPersianDigits(service.price)} تومان` : "توافقی"}</span>
                  <span className="svcChip"><Timer size={12} /> {service.duration}</span>
                  <span className="svcChip"><CalendarCheck size={12} /> قابل رزرو</span>
                </div>
              </div>
              <div className="svcCardSide">
                <div className="svcActions">
                  <button type="button" aria-label="ویرایش" title="ویرایش" onClick={() => onEdit?.(service)}>
                    <Pencil size={15} />
                  </button>
                  <button type="button" className="danger" aria-label="حذف" title="حذف" onClick={() => onDelete?.(service.id)}>
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

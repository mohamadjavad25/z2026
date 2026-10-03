"use client";

import { CalendarCheck, Pencil, Plus, Timer, Trash2 } from "lucide-react";
import { toPersianDigits } from "../../shared/lib/digits";
import { ServiceEmoji } from "../../components/ServiceEmoji";
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
      <div className="artistServiceHead">
        <div className="artistServiceHeadActions">
          <button type="button" onClick={onCreate}>
            <Plus size={15} />
            افزودن خدمت
          </button>
        </div>
      </div>

      <div className="artistServiceList">
        {services.length === 0 ? (
          <ProfileEmptyState
            className="artistServiceEmpty"
            image="/artist-services-empty.png"
            title="هنوز خدمتی ثبت نشده"
            description="اولین خدمت را اضافه کن تا قیمت، مدت‌زمان و رزرو مستقیم برای مشتری روشن شود."
            actionLabel="افزودن اولین خدمت"
            onAction={onCreate}
          />
        ) : (
          services.map((service, index) => (
            <article
              className={`artistServiceCard is-${service.tone || "soft"}${service.badge ? " has-badge" : ""}`}
              key={service.id}
              style={{ "--service-delay": `${index * 55}ms` }}
            >
              <ServiceEmoji id={service.emoji} name={service.name} size={44} className="artistServiceEmoji" />
              <div className="artistServiceMain">
                <div className="artistServiceTitleRow">
                  <strong>{service.name}</strong>
                  {service.badge ? (
                    <em className={`artistServiceBadge is-${service.tone || "soft"}`}>{service.badge}</em>
                  ) : null}
                </div>
                <p>{service.hint}</p>
                <div className="artistServiceMeta">
                  <span><Timer size={13} /> {service.duration}</span>
                  <span><CalendarCheck size={13} /> قابل رزرو</span>
                </div>
              </div>
              <div className="artistServiceSide">
                <b>{service.price ? `${toPersianDigits(service.price)} تومان` : "توافقی"}</b>
                <div className="artistServiceActions">
                  <button type="button" aria-label="ویرایش" title="ویرایش" onClick={() => onEdit?.(service)}>
                    <Pencil size={14} />
                  </button>
                  <button type="button" className="danger" aria-label="حذف" title="حذف" onClick={() => onDelete?.(service.id)}>
                    <Trash2 size={14} />
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

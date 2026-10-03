"use client";

import { Check, Pencil, Plus, Trash2, UserRound } from "lucide-react";
import { toPersianDigits } from "../../shared/lib/digits";
import { ServiceIcon } from "../../components/ServiceIcon";
import { ServiceIconStrip } from "../../components/ServiceIconStrip";
import { ProfileEmptyState } from "../profile/ProfileEmptyState";

/**
 * Salon owner — services manager (workspace key "hours" / label خدمات).
 * Presentational: service rows + artist assign + create/edit/delete callbacks.
 */
export function SalonServicesWorkspace({
  services = [],
  staffList = [],
  serviceArtistMenuId = null,
  onMenuToggle,
  onCreate,
  onToggleArtist,
  onClearArtists,
  onEdit,
  onDelete
}) {
  return (
    <>
      <div className="svcToolbar">
        <div>
          <span>خدمات</span>
          <b>منوی خدمات · {toPersianDigits(services.length)}</b>
        </div>
        <button type="button" className="svcAddBtn" onClick={onCreate}>
          <Plus size={16} />
          افزودن
        </button>
      </div>
      <div className="svcList salonServiceManagerList">
        {services.length === 0 ? (
          <ProfileEmptyState
            className="artistServiceEmpty"
            visual={<ServiceIconStrip />}
            title="هنوز خدمتی ثبت نشده"
            description="خدمت‌ها را تعریف کن تا مشتری بتواند روز، ساعت و آرتیست مناسب را انتخاب کند."
            actionLabel="افزودن اولین خدمت"
            onAction={onCreate}
          />
        ) : (
          services.map((service) => {
            const selectedArtistIds = Array.isArray(service.staff_ids)
              ? service.staff_ids.map(String)
              : service.staff_id
                ? [String(service.staff_id)]
                : [];
            const selectedArtists = staffList.filter((person) => selectedArtistIds.includes(String(person.id)));
            const fallbackAssignedStaff = staffList.find((person) => String(person.id) === String(service.staff_id));
            const visibleArtists = selectedArtists.length ? selectedArtists : fallbackAssignedStaff ? [fallbackAssignedStaff] : [];
            const artistLabel = visibleArtists.length
              ? visibleArtists.map((person) => person.name).join("، ")
              : "";
            const menuOpen = String(serviceArtistMenuId) === String(service.id);
            return (
              <article
                className={`svcCard is-manager${menuOpen ? " is-pickingArtist" : ""}`}
                key={service.id}
              >
                <ServiceIcon emoji={service.emoji} name={service.name} size="lg" />
                <div className="svcCardBody">
                  <div className="svcCardTitle"><strong>{service.name}</strong></div>
                  {service.hint ? <p className="svcCardHint">{service.hint}</p> : null}
                  <div className="svcCardMeta">
                    <span className="svcChip is-price">{service.price ? `${toPersianDigits(service.price)} تومان` : "قیمت را تنظیم کن"}</span>
                    <span className="svcChip">{service.duration || "زمان را تنظیم کن"}</span>
                  </div>
                  <div className="serviceArtistPick">
                    <button
                      type="button"
                      className={`serviceArtistPickBtn${artistLabel ? " hasArtist" : ""}`}
                      aria-label={artistLabel ? `آرتیست‌ها: ${artistLabel}` : "انتخاب آرتیست‌ها"}
                      aria-expanded={menuOpen}
                      aria-haspopup="listbox"
                      title={artistLabel || "انتخاب آرتیست‌ها"}
                      onClick={() => onMenuToggle?.(menuOpen ? null : service.id)}
                    >
                      <span className={`serviceArtistStack${visibleArtists.length ? "" : " is-empty"}`} aria-hidden="true">
                        {visibleArtists.length ? (
                          visibleArtists.slice(0, 2).map((person) => {
                            const avatar = person.avatar || person.staff_avatar || "";
                            return (
                              <span className={`serviceArtistAvatar ${avatar ? "hasImage" : ""}`} key={person.id || person.name}>
                                {avatar ? <img src={avatar} alt="" /> : String(person.name || "آ").slice(0, 1)}
                              </span>
                            );
                          })
                        ) : (
                          <span className="serviceArtistAvatar is-icon">
                            <UserRound size={14} />
                          </span>
                        )}
                        <span className="serviceArtistAvatar is-icon is-plus">
                          <Plus size={14} />
                        </span>
                      </span>
                    </button>
                    {menuOpen ? (
                      <div
                        className="serviceArtistMenu"
                        role="listbox"
                        aria-label="لیست آرتیست‌ها"
                        aria-multiselectable="true"
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={(event) => event.stopPropagation()}
                      >
                        {staffList.length === 0 ? (
                          <p>هنوز پرسنلی ثبت نشده</p>
                        ) : (
                          <>
                            {staffList.map((person) => {
                              const selected = selectedArtistIds.includes(String(person.id));
                              return (
                                <button
                                  type="button"
                                  role="option"
                                  aria-selected={selected}
                                  className={selected ? "is-selected" : ""}
                                  key={person.id || person.name}
                                  onPointerDown={(event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    onToggleArtist?.(service, person.id);
                                  }}
                                  onClick={(event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                  }}
                                >
                                  <span>
                                    <b>{person.name}</b>
                                    <small>{person.role || "آرتیست"}</small>
                                  </span>
                                  {selected ? <Check size={14} /> : null}
                                </button>
                              );
                            })}
                            {selectedArtistIds.length ? (
                              <button
                                type="button"
                                className="is-clear"
                                onPointerDown={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  onClearArtists?.(service);
                                }}
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                }}
                              >
                                حذف همه آرتیست‌ها
                              </button>
                            ) : null}
                          </>
                        )}
                      </div>
                    ) : null}
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
            );
          })
        )}
      </div>
    </>
  );
}
